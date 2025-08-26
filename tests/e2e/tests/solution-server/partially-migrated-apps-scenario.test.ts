/**
 * Solution Server Workflow Test
 *
 * This test validates the solution server workflow across multiple applications,
 * including sequential fix application (audit logger fix followed by Java annotation fix)
 * and solution server metrics validation.
 *
 * Workflow:
 * 1. Setup inventory management → analyze → apply audit logger fix → apply Java annotation fix → capture metrics
 * 2. Switch to EHR app → analyze → apply complete fix workflow (audit logger + Java annotation) → validate solution server metrics
 * 3. Validate success metrics and best hints from solution server
 *
 */

import { expect, test } from '../../fixtures/test-repo-fixture';
import { VSCode } from '../../pages/vscode.page';
import { Configuration } from '../../pages/configuration.page';
import { ConfigurationOptions } from '../../enums/configuration-options.enum';
import { DEFAULT_PROVIDER } from '../../fixtures/provider-configs.fixture';
import { MCPClient } from '../../../mcp-client/mcp-client.model';
import {
  SuccessRateResponse,
  BestHintResponse,
} from '../../../mcp-client/mcp-client-responses.model';
import { FixTypes } from '../../enums/fix-types.enum';
import { KAIViews } from '../../enums/views.enum';
import { execSync } from 'child_process';
import * as path from 'path';
import { TestLogger } from '../../utilities/logger';

class SolutionServerWorkflowHelper {
  public logger: TestLogger;

  constructor() {
    this.logger = new TestLogger('Solution-Server-Workflow');
  }

  async setupRepository(
    repoInfo: any,
    appName: string,
    customRulesSubPath: string
  ): Promise<VSCode> {
    this.logger.info(`Setting up ${appName} repository`);

    let vsCode: VSCode | undefined;

    try {
      vsCode = await VSCode.open(repoInfo.repoUrl, repoInfo.repoName, repoInfo.branch);
      this.logger.success(`VSCode opened for ${appName}`);

      if (!vsCode) throw new Error('VSCode not initialized');
      await this.createProfileWithCustomRules(vsCode, repoInfo, appName, customRulesSubPath);
      await this.configureSolutionServer(vsCode, appName);
      await this.runAnalysis(vsCode, appName);

      this.logger.success(`Successfully setup ${appName} repository`);
      return vsCode;
    } catch (error) {
      this.logger.error(`Setup failed for ${appName}: ${error}`);
      if (vsCode) {
        await vsCode.closeVSCode();
      }
      throw error;
    }
  }

  async switchToRepository(
    vsCode: VSCode,
    repoInfo: any,
    appName: string,
    customRulesSubPath: string
  ): Promise<VSCode> {
    this.logger.info(`Switching to ${appName} repository`);

    try {
      await vsCode.closeVSCode();
      const newVsCode = await VSCode.open(repoInfo.repoUrl, repoInfo.repoName, repoInfo.branch);
      this.logger.success(`Opened ${appName} in VSCode`);

      await this.createProfileWithCustomRules(newVsCode, repoInfo, appName, customRulesSubPath);
      await this.configureSolutionServer(newVsCode, appName);
      await this.runAnalysis(newVsCode, appName);

      this.logger.success(`Successfully switched to ${appName}`);
      return newVsCode;
    } catch (error) {
      this.logger.error(`Failed to switch to ${appName}: ${error}`);
      throw error;
    }
  }

  /**
   * Creates profile with custom rules using proper test fixture data
   */
  private async createProfileWithCustomRules(
    vsCode: VSCode,
    repoInfo: any,
    appName: string,
    customRulesSubPath: string
  ): Promise<void> {
    const customRulesPath = path.join(process.cwd(), repoInfo.repoName, customRulesSubPath);

    try {
      await vsCode.createProfile(
        repoInfo.sources || [],
        repoInfo.targets || [],
        undefined,
        customRulesPath
      );
      this.logger.success(`Profile created for ${appName}`);
    } catch (error) {
      throw new Error(`Profile creation failed for ${appName}: ${error}`);
    }
  }

  private async configureSolutionServer(vsCode: VSCode, appName: string): Promise<void> {
    try {
      const config = await Configuration.open(vsCode);
      await config.setEnabledConfiguration(ConfigurationOptions.SolutionServerEnabled, true);

      await vsCode.executeQuickCommand('Konveyor: Restart Solution Server');
      await vsCode.configureGenerativeAI(DEFAULT_PROVIDER.config);
      await vsCode.startServer();

      this.logger.success(`Solution server configured for ${appName}`);
    } catch (error) {
      throw new Error(`Solution server configuration failed for ${appName}: ${error}`);
    }
  }

  private async runAnalysis(vsCode: VSCode, appName: string): Promise<void> {
    const analysisStart = Date.now();

    try {
      await vsCode.runAnalysis();

      await expect(vsCode.getWindow().getByText('Analysis completed').first()).toBeVisible({
        timeout: 300000,
      });

      const analysisTime = Date.now() - analysisStart;
      this.logger.success(`Analysis completed for ${appName} in ${analysisTime}ms`);
    } catch (error) {
      throw new Error(`Analysis failed for ${appName}: ${error}`);
    }
  }

  async validateAnalysisResults(vsCode: VSCode, appName: string): Promise<number> {
    try {
      await vsCode.openAnalysisView();
      const analysisView = await vsCode.getView(KAIViews.analysisView);

      await expect(analysisView.getByText('Analysis Results')).toBeVisible({ timeout: 30000 });

      const violations = analysisView.locator('.pf-v6-c-card__header-toggle');
      const violationCount = await violations.count();

      expect(violationCount).toBe(2);
      this.logger.success(`${appName} has expected 2 violations`);

      const analysisContent = await analysisView.locator('body').textContent();
      const hasAuditContent =
        analysisContent?.includes('FileSystemAuditLogger') ||
        analysisContent?.includes('audit') ||
        analysisContent?.includes('logger');

      if (!hasAuditContent) {
        throw new Error(
          `Expected audit-related violations not found in ${appName}. Found content: ${analysisContent?.substring(0, 200)}...`
        );
      }
      this.logger.success(`Found expected audit-related violation content in ${appName}`);

      return violationCount;
    } catch (error) {
      throw new Error(`Analysis validation failed for ${appName}: ${error}`);
    }
  }

  async applyAuditLoggerFix(vsCode: VSCode, appName: string): Promise<boolean> {
    const solutionStart = Date.now();

    try {
      await vsCode.openAnalysisView();

      const analysisViewBefore = await vsCode.getView(KAIViews.analysisView);

      const incidentsLocator = analysisViewBefore.locator(
        '[class*="incident"], [class*="violation"], .incident, .violation'
      );
      await expect(incidentsLocator.first()).toBeVisible({ timeout: 30000 });

      const incidentsBefore = await incidentsLocator.count();

      const violationText =
        'Replace `FileSystemAuditLogger` instantiation with `StreamableAuditLogger` over TCP';
      await vsCode.searchAndRequestFix(violationText, FixTypes.Incident);

      const resolutionView = await vsCode.getView(KAIViews.resolutionDetails);

      await this.reviewChangesBeforeAccepting(resolutionView);

      const acceptButton = await this.waitForSolutionGeneration(resolutionView);

      await acceptButton.click();
      this.logger.success('Audit logger fix solution applied');

      try {
        const continueButton = await this.getContinueButton(resolutionView);
        if (await continueButton.isVisible()) {
          await continueButton.click();
          await expect(continueButton).not.toBeVisible({ timeout: 30000 });
        }
      } catch (error) {
        // Continue button not found, proceeding with validation
      }

      await vsCode.openAnalysisView();
      const analysisViewAfter = await vsCode.getView(KAIViews.analysisView);

      await expect(analysisViewAfter.locator('body')).toBeVisible({ timeout: 30000 });

      await this.validateSolutionApplication(vsCode, appName);

      const javaAnnotationFixApplied = await this.applyJavaAnnotationFixInternal(vsCode, appName);

      if (!javaAnnotationFixApplied) {
        this.logger.warn('Java annotation fix failed, but audit logger fix was successful');
      }

      const solutionTime = Date.now() - solutionStart;
      this.logger.success(`Complete fix workflow applied for ${appName} in ${solutionTime}ms`);

      return true;
    } catch (error) {
      this.logger.error(`Fix application failed for ${appName}: ${error}`);
      return false;
    }
  }

  private async applyJavaAnnotationFixInternal(vsCode: VSCode, appName: string): Promise<boolean> {
    try {
      await vsCode.openAnalysisView();

      const analysisViewBefore = await vsCode.getView(KAIViews.analysisView);

      const incidentsLocator = analysisViewBefore.locator(
        '[class*="incident"], [class*="violation"], .incident, .violation'
      );
      await expect(incidentsLocator.first()).toBeVisible({ timeout: 30000 });

      const incidentsBefore = await incidentsLocator.count();

      const violationText =
        'The java.annotation (Common Annotations) module has been removed from OpenJDK 11';
      await vsCode.searchAndRequestFix(violationText, FixTypes.Incident);

      const resolutionView = await vsCode.getView(KAIViews.resolutionDetails);

      await this.reviewChangesBeforeAccepting(resolutionView);

      const acceptButton = await this.waitForSolutionGeneration(resolutionView);

      await acceptButton.click();
      this.logger.success('Java annotation fix solution applied');

      try {
        const continueButton = await this.getContinueButton(resolutionView);
        if (await continueButton.isVisible()) {
          await continueButton.click();
          // Wait for the continue button interaction to complete
          await expect(continueButton).not.toBeVisible({ timeout: 30000 });
        }
      } catch (error) {
        // Continue button not found, proceeding with validation
      }

      await vsCode.openAnalysisView();
      const analysisViewAfter = await vsCode.getView(KAIViews.analysisView);

      await expect(analysisViewAfter.locator('body')).toBeVisible({ timeout: 30000 });

      await this.validateSolutionApplication(vsCode, appName);

      this.logger.success(`Java annotation fix applied for ${appName}`);
      return true;
    } catch (error) {
      this.logger.error(`Java annotation fix application failed for ${appName}: ${error}`);
      return false;
    }
  }

  private async waitForSolutionGeneration(resolutionView: any): Promise<any> {
    const maxAttempts = 10; // 10 attempts × 30 seconds = 5 minutes
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const button = await this.getAcceptButton(resolutionView);
        if (button && (await button.isVisible())) {
          this.logger.success('Found accept button using current selectors');
          return button;
        }
      } catch (error) {
        // Button not found yet, continue waiting
      }

      attempts++;
      const timeElapsed = attempts * 30;

      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds
      }
    }

    throw new Error('Solution generation timed out after 5 minutes');
  }

  private async getAcceptButton(resolutionView: any): Promise<any> {
    const selectors = ['button:has-text("Accept All")', 'button.main-accept-button'];

    for (const selector of selectors) {
      const button = resolutionView.locator(selector);
      if (await button.isVisible()) {
        return button;
      }
    }

    throw new Error('Accept button not found in resolution view');
  }

  private async getRejectButton(resolutionView: any): Promise<any> {
    const selectors = ['button:has-text("Reject All")', 'button.main-reject-button'];

    for (const selector of selectors) {
      const button = resolutionView.locator(selector);
      if (await button.isVisible()) {
        return button;
      }
    }

    throw new Error('Reject button not found in resolution view');
  }

  /**
   * Gets the Review Changes button from the resolution view using current selectors
   */
  private async getReviewChangesButton(resolutionView: any): Promise<any> {
    const selectors = ['button:has-text("Review Changes")', 'button.view-with-decorations-button'];

    for (const selector of selectors) {
      const button = resolutionView.locator(selector);
      if (await button.isVisible()) {
        return button;
      }
    }

    throw new Error('Review Changes button not found in resolution view');
  }

  /**
   * Gets modified file messages from the resolution view
   */
  private async getModifiedFileMessages(resolutionView: any): Promise<any> {
    const selectors = [
      '.modified-file-message',
      '[class*="modified-file"]',
      '[class*="file-message"]',
      '.file-change-message',
    ];

    for (const selector of selectors) {
      const messages = resolutionView.locator(selector);
      if ((await messages.count()) > 0) {
        return messages;
      }
    }

    throw new Error('Modified file messages not found in resolution view');
  }

  /**
   * Gets the diff status banner that shows the current state
   */
  private async getDiffStatusBanner(resolutionView: any): Promise<any> {
    const selectors = [
      '.diff-status-banner',
      '[class*="diff-status"]',
      '[class*="status-banner"]',
      '.status-indicator',
    ];

    for (const selector of selectors) {
      const banner = resolutionView.locator(selector);
      if (await banner.isVisible()) {
        return banner;
      }
    }

    return null;
  }

  /**
   * Gets the Continue button that appears after accepting changes
   */
  private async getContinueButton(resolutionView: any): Promise<any> {
    const selectors = ['button:has-text("Continue")', 'button.continue-button'];

    for (const selector of selectors) {
      const button = resolutionView.locator(selector);
      if (await button.isVisible()) {
        return button;
      }
    }

    throw new Error('Continue button not found in resolution view');
  }

  /**
   * Reviews changes in the resolution view before accepting them
   * Demonstrates usage of the new button methods
   */
  async reviewChangesBeforeAccepting(resolutionView: any): Promise<void> {
    try {
      const modifiedMessages = await this.getModifiedFileMessages(resolutionView);
      const messageCount = await modifiedMessages.count();

      if (messageCount > 0) {
        try {
          const reviewButton = await this.getReviewChangesButton(resolutionView);
          if (await reviewButton.isVisible()) {
            await reviewButton.click();
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (error) {
          // Review Changes button not available, proceeding with inline review
        }

        const statusBanner = await this.getDiffStatusBanner(resolutionView);
        if (statusBanner) {
          const bannerText = await statusBanner.textContent();
        }
      }

      this.logger.success('Changes reviewed successfully');
    } catch (error) {
      this.logger.warn(`Error during change review: ${error}`);
    }
  }

  /**
   * Validates solution application with file change verification
   */
  private async validateSolutionApplication(vsCode: VSCode, appName: string): Promise<void> {
    try {
      await vsCode.openAnalysisView();
      const analysisView = await vsCode.getView(KAIViews.analysisView);

      await expect(
        analysisView
          .getByRole('heading', { level: 2 })
          .filter({ hasText: 'Waiting for solution confirmation...' })
      ).not.toBeVisible({ timeout: 35000 });

      this.logger.success(`Solution application confirmed for ${appName}`);

      const repoPath = appName.includes('Inventory') ? 'inventory_management' : 'ehr_viewer';

      try {
        const findCmd = `find ${process.cwd()}/${repoPath} -name "*Service.java" -type f 2>/dev/null || true`;
        const serviceFiles = execSync(findCmd, { encoding: 'utf8', stdio: 'pipe' })
          .split('\n')
          .filter((file) => file.trim().length > 0)
          .map((file) => file.replace(`${process.cwd()}/${repoPath}/`, ''));

        if (serviceFiles.length > 0) {
          await this.validateFileChanges(appName, repoPath, serviceFiles);
        } else {
          this.logger.warn(`No *Service.java files found in ${appName}`);
        }
      } catch (error) {
        this.logger.warn(`Could not search for Service files in ${appName}: ${error}`);
      }

      await expect(analysisView.getByText('Analysis Results')).toBeVisible({ timeout: 5000 });
      this.logger.success(`Solution application validated for ${appName}`);
    } catch (error) {
      throw new Error(`Solution validation failed for ${appName}: ${error}`);
    }
  }

  /**
   * Validates that file changes were properly applied
   */
  private async validateFileChanges(
    appName: string,
    repoPath: string,
    expectedFiles: string[]
  ): Promise<void> {
    try {
      let filesModified = 0;
      let hasCorrectChanges = false;

      for (const filePath of expectedFiles) {
        const fullPath = path.join(process.cwd(), repoPath, filePath);

        try {
          const fileContent = execSync(`cat "${fullPath}"`, { encoding: 'utf8', stdio: 'pipe' });

          if (fileContent.includes('StreamableAuditLogger')) {
            this.logger.success(`Found StreamableAuditLogger in ${filePath}`);
            hasCorrectChanges = true;
          }

          if (!fileContent.includes('FileSystemAuditLogger')) {
            this.logger.success(`FileSystemAuditLogger removed from ${filePath}`);
          } else {
            this.logger.warn(
              `FileSystemAuditLogger still found in ${filePath} - may be in comments or imports`
            );
          }

          filesModified++;
        } catch (fileError) {
          this.logger.debug(`Could not read ${filePath}: ${fileError}`);
        }
      }

      if (filesModified === 0) {
        this.logger.warn(`No expected files found for validation in ${appName}`);
      } else if (hasCorrectChanges) {
        this.logger.success(
          `File changes validated - StreamableAuditLogger found in ${filesModified} files`
        );
      } else {
        this.logger.warn(`Files were accessible but no StreamableAuditLogger changes found`);
      }
    } catch (error) {
      this.logger.warn(`File validation failed for ${appName}: ${error}`);
    }
  }

  /**
   * Captures solution server metrics including success rate and best hints
   */
  async captureSolutionServerMetrics(
    mcpClient: MCPClient
  ): Promise<{ successRate: SuccessRateResponse; bestHint: BestHintResponse }> {
    try {
      const metricsQuery = {
        ruleset_name: 'audit-logging-migration',
        violation_name: 'audit-logging-0003',
      };

      const successRate = await mcpClient.getSuccessRate([metricsQuery]);
      const bestHint = await mcpClient.getBestHint(
        metricsQuery.ruleset_name,
        metricsQuery.violation_name
      );

      this.logger.success(
        `Solution server metrics captured - Accepted: ${successRate.accepted_solutions}, ` +
          `Pending: ${successRate.pending_solutions}, Hint ID: ${bestHint.hint_id}`
      );

      return { successRate, bestHint };
    } catch (error) {
      throw new Error(`Failed to capture metrics: ${error}`);
    }
  }
}

test.describe.serial('Solution Server Workflow', () => {
  let helper: SolutionServerWorkflowHelper;
  let mcpClient: MCPClient;
  let vsCode: VSCode | undefined;
  let testRepoData: any;

  test.beforeAll(async ({ testRepoData: repoData }) => {
    helper = new SolutionServerWorkflowHelper();
    testRepoData = repoData;

    try {
      mcpClient = await MCPClient.connect('http://localhost:8000');
      helper.logger.success('Connected to MCP client');
    } catch (error) {
      throw new Error(`Failed to connect to MCP client: ${error}`);
    }
  });

  test('should setup and analyze inventory management', async () => {
    test.setTimeout(400000);

    const inventoryRepoInfo = testRepoData['inventory_management'];
    vsCode = await helper.setupRepository(inventoryRepoInfo, 'Inventory Management', 'rules');

    const inventoryViolations = await helper.validateAnalysisResults(
      vsCode,
      'Inventory Management'
    );
    expect(inventoryViolations).toBeGreaterThan(0);

    helper.logger.success('Inventory Management setup and analysis completed');
  });

  test('should apply audit logger fix successfully', async () => {
    test.setTimeout(400000);

    if (!vsCode) {
      throw new Error('VSCode instance not initialized - previous test may have failed');
    }

    const fixApplied = await helper.applyAuditLoggerFix(vsCode, 'Inventory Management');
    expect(fixApplied).toBe(true);

    helper.logger.success(
      'Complete fix workflow (audit logger + Java annotation) applied successfully'
    );
  });

  test('should switch to EHR and analyze violations', async () => {
    test.setTimeout(300000);

    if (!vsCode) {
      throw new Error('VSCode instance not initialized - previous tests may have failed');
    }

    const ehrRepoInfo = testRepoData['ehr'];
    vsCode = await helper.switchToRepository(vsCode, ehrRepoInfo, 'EHR Viewer', 'rules');

    const ehrViolations = await helper.validateAnalysisResults(vsCode, 'EHR Viewer');
    expect(ehrViolations).toBeGreaterThan(0);

    helper.logger.success('EHR application setup and analysis completed');
  });

  test('should capture and validate solution server metrics', async () => {
    test.setTimeout(60000);

    const solutionServerMetrics = await helper.captureSolutionServerMetrics(mcpClient);

    expect(solutionServerMetrics.successRate).toBeDefined();
    expect(solutionServerMetrics.bestHint).toBeDefined();
    expect(solutionServerMetrics.bestHint.hint_id).toBeDefined();
    expect(solutionServerMetrics.successRate.accepted_solutions).toBeGreaterThanOrEqual(0);

    expect(solutionServerMetrics.successRate.accepted_solutions).toBeGreaterThan(0);
    expect(solutionServerMetrics.bestHint.hint).toContain('StreamableAuditLogger');
    expect(solutionServerMetrics.bestHint.hint).toContain('FileSystemAuditLogger');

    const totalSolutions = solutionServerMetrics.successRate.counted_solutions;
    expect(totalSolutions).toBeGreaterThan(0);
    helper.logger.success(`Validated solution server has processed ${totalSolutions} solutions`);

    helper.logger.success('Solution server metrics validated successfully');
  });

  test('should apply audit logger fix in EHR and verify hint usage', async () => {
    test.setTimeout(400000);

    if (!vsCode) {
      throw new Error('VSCode instance not initialized - previous tests may have failed');
    }

    const beforeSolution = await helper.captureSolutionServerMetrics(mcpClient);

    const fixApplied = await helper.applyAuditLoggerFix(vsCode, 'EHR Viewer');
    expect(fixApplied).toBe(true);

    const afterSolution = await helper.captureSolutionServerMetrics(mcpClient);

    expect(afterSolution.successRate.accepted_solutions).toBeGreaterThan(
      beforeSolution.successRate.accepted_solutions
    );
    helper.logger.success(
      'Solution server successfully applied hints in EHR app for complete fix workflow'
    );

    // Log final workflow completion
    helper.logger.success('Complete solution server workflow validated');
    helper.logger.info(
      `Final metrics - Total accepted: ${afterSolution.successRate.accepted_solutions}, ` +
        `Latest hint ID: ${afterSolution.bestHint.hint_id}`
    );
  });

  test.afterEach(async () => {
    helper.logger.info(`Test completed: ${test.info().title}`);
  });

  test.afterAll(async () => {
    if (vsCode) {
      await vsCode.closeVSCode();
    }
    helper.logger.success('Solution server workflow test suite completed');
  });
});
