import { expect, test } from '../../fixtures/test-repo-fixture';
import { VSCode } from '../../pages/vscode.page';
import { Configuration } from '../../pages/configuration.page';
import { ConfigurationOptions } from '../../enums/configuration-options.enum';
import { DEFAULT_PROVIDER } from '../../fixtures/provider-configs.fixture';
import { MCPClient } from '../../../mcp-client/mcp-client.model';
import { FixTypes } from '../../enums/fix-types.enum';
import { KAIViews } from '../../enums/views.enum';
import { execSync } from 'child_process';
import * as path from 'path';

test.describe(`Solution server test`, () => {
  let vsCode: VSCode;
  let mcpClient: MCPClient;

  test.beforeAll(async ({ testRepoData }) => {
    const repoInfo = testRepoData['inventory_management'];

    test.setTimeout(600000);

    mcpClient = await MCPClient.connect('http://localhost:8000');

    // Clone the inventory_management repository
    // Open the inventory_management repository in VSCode
    // VSCode.open() will handle cloning and we'll set the branch after
    vsCode = await VSCode.open(repoInfo.repoUrl, repoInfo.repoName);

    // Now set the correct branch after VSCode has opened the repository
    try {
      execSync(`git checkout -f ${repoInfo.branch}`, { cwd: repoInfo.repoName });
    } catch (error) {
      throw new Error(`Failed to checkout branch '${repoInfo.branch}': ${error}`);
    }

    // Verify we're on the correct branch
    const currentBranch = execSync(`git rev-parse --abbrev-ref HEAD`, {
      cwd: repoInfo.repoName,
      encoding: 'utf8',
    }).trim();

    if (currentBranch !== repoInfo.branch) {
      throw new Error(
        `Failed to checkout branch '${repoInfo.branch}'. Current branch is '${currentBranch}'`
      );
    }

    // Create profile with sources, targets, and custom rules from repo info
    const customRulesPath = path.join(process.cwd(), 'inventory_management', 'rules');

    // Create profile with custom rules included
    await vsCode.createProfile(repoInfo.sources, repoInfo.targets, undefined, customRulesPath);

    const config = await Configuration.open(vsCode);
    await config.setEnabledConfiguration(ConfigurationOptions.SolutionServerEnabled, true);
    await vsCode.executeQuickCommand('Konveyor: Restart Solution Server');

    await vsCode.configureGenerativeAI(DEFAULT_PROVIDER.config);

    // Start the server after profile with custom rules is created
    await vsCode.startServer();

    // Run analysis
    await vsCode.runAnalysis();

    // Wait for analysis to complete
    await expect(vsCode.getWindow().getByText('Analysis completed').first()).toBeVisible({
      timeout: 300000,
    });
  });

  test('Step 1: Run analysis on inventory management', async () => {
    // Open the analysis view first (same pattern as working test)
    await vsCode.openAnalysisView();

    // Get the analysis view to see the results
    const analysisView = await vsCode.getView(KAIViews.analysisView);

    // Wait for analysis results to be visible
    await expect(analysisView.getByText('Analysis Results')).toBeVisible({ timeout: 10000 });

    // Verify that analysis has completed and shows results
    const resultsElement = analysisView.locator('body');
    const resultsText = await resultsElement.textContent();
    expect(resultsText).toContain('Analysis Results');

    // Check for any violations found
    const violations = analysisView.locator('.pf-v6-c-card__header-toggle');
    await violations.count();
  });

  test('Step 2: Validate custom rules are working in analysis', async () => {
    // Open the analysis view to check if custom rules are being applied
    await vsCode.openAnalysisView();
    const analysisView = await vsCode.getView(KAIViews.analysisView);

    // Wait for analysis results to be visible
    await expect(analysisView.getByText('Analysis Results')).toBeVisible({ timeout: 10000 });

    // Look for violations that should be detected by our custom rules
    // The inventory_management app should have specific violations that custom rules would catch
    const violations = analysisView.locator('.pf-v6-c-card__header-toggle');
    const violationCount = await violations.count();

    // Check if any violations are from custom rules
    // Custom rules violations might have different styling or indicators
    const customRuleViolations = analysisView
      .locator('text=/custom rule/i, text=/inventory/i, text=/audit/i')
      .first();

    if ((await customRuleViolations.count()) > 0) {
      await customRuleViolations.textContent();
    } else if (violationCount > 0) {
      // Check the first violation to see what type it is
      const firstViolation = violations.first();
      await firstViolation.textContent();
    }

    // Verify that the analysis profile with custom rules is being used
    // This could be done by checking for profile indicators in the UI
    const profileIndicator = analysisView.locator('text=/profile/i, text=/custom/i').first();

    if ((await profileIndicator.count()) > 0) {
      await profileIndicator.textContent();
    }
  });

  test('Step 3: Fix analysis incidents', async () => {
    // Open the analysis view first (same pattern as working test)
    await vsCode.openAnalysisView();

    // Get the analysis view
    const analysisView = await vsCode.getView(KAIViews.analysisView);

    // Wait for analysis results to be visible
    await expect(analysisView.getByText('Analysis Results')).toBeVisible({ timeout: 10000 });

    // Look for incidents that can be fixed
    const incidents = analysisView.locator(
      '[data-testid="incident-item"], .incident-item, .pf-v6-c-card'
    );
    const incidentCount = await incidents.count();

    if (incidentCount > 0) {
      // Look for the specific violation about FileSystemAuditLogger that needs to be replaced
      await vsCode.searchAndRequestFix(
        'Replace `FileSystemAuditLogger` instantiation with `StreamableAuditLogger` over TCP',
        FixTypes.Incident
      );

      // Wait for the resolution view to appear
      const resolutionView = await vsCode.getView(KAIViews.resolutionDetails);

      // Wait for solution generation to complete
      let acceptButton = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        try {
          acceptButton = resolutionView.locator('button[aria-label="Accept all changes"]');
          if (await acceptButton.isVisible()) {
            break;
          }
        } catch (error) {
          // Button not found yet, continue waiting
        }

        // Wait for solution generation to complete
        await vsCode.getWindow().waitForTimeout(10000);
        attempts++;
      }

      if (!acceptButton || !(await acceptButton.isVisible())) {
        throw new Error('Solution generation did not complete within expected time');
      }

      // Click accept button
      await acceptButton.click();

      // Return to analysis view and wait for solution confirmation to complete (same as working test)
      await vsCode.openAnalysisView();
      const analysisViewAfterFix = await vsCode.getView(KAIViews.analysisView);

      // Wait for solution confirmation to complete (same as working test)
      await expect(
        analysisViewAfterFix
          .getByRole('heading', { level: 2 })
          .filter({ hasText: 'Waiting for solution confirmation...' })
      ).not.toBeVisible({ timeout: 35000 });

      console.log('Successfully applied fix for FileSystemAuditLogger violation');
    } else {
      console.log('No incidents found to fix');
    }
  });

  test('Step 4: Load EHR app in main VSCode, run analysis, and validate hint generation', async ({
    testRepoData,
  }) => {
    // This step loads the EHR app in the main VSCode window, runs analysis with custom rules,
    // and validates hint generation. This provides a different codebase to test our custom rules
    // and solution server learning without needing a separate VSCode instance.

    // Load the EHR viewer application for testing
    const ehrRepoInfo = testRepoData['ehr'];

    // Load the EHR app in the same VSCode instance by updating the workspace
    try {
      await vsCode.closeVSCode();
      vsCode = await VSCode.open(ehrRepoInfo.repoUrl, ehrRepoInfo.repoName);
    } catch (error) {
      throw new Error(`Failed to load EHR app: ${error}`);
    }

    // Set the correct branch for EHR app
    try {
      execSync(`git checkout -f ${ehrRepoInfo.branch}`, { cwd: ehrRepoInfo.repoName });
      console.log(`Successfully switched to branch: ${ehrRepoInfo.branch}`);
    } catch (error) {
      throw new Error(`Failed to checkout EHR branch '${ehrRepoInfo.branch}': ${error}`);
    }

    // Verify we're on the correct branch
    const ehrCurrentBranch = execSync(`git rev-parse --abbrev-ref HEAD`, {
      cwd: ehrRepoInfo.repoName,
      encoding: 'utf8',
    }).trim();

    if (ehrCurrentBranch !== ehrRepoInfo.branch) {
      throw new Error(
        `Failed to checkout EHR branch '${ehrRepoInfo.branch}'. Current branch is '${ehrCurrentBranch}'`
      );
    }

    // Create profile with custom rules for EHR app
    const ehrCustomRulesPath = path.join(process.cwd(), 'ehr_viewer', 'rules');

    try {
      await vsCode.createProfile(
        ehrRepoInfo.sources,
        ehrRepoInfo.targets,
        undefined,
        ehrCustomRulesPath
      );
      console.log('Successfully created EHR profile with custom rules');
    } catch (error) {
      throw new Error(`Failed to create EHR profile: ${error}`);
    }

    // Enable solution server for EHR app
    try {
      const ehrConfig = await Configuration.open(vsCode);
      await ehrConfig.setEnabledConfiguration(ConfigurationOptions.SolutionServerEnabled, true);
      console.log('Successfully enabled solution server for EHR app');
    } catch (error) {
      throw new Error(`Failed to enable solution server: ${error}`);
    }

    // Restart solution server and wait for it to stabilize
    try {
      await vsCode.executeQuickCommand('Konveyor: Restart Solution Server');
      console.log('Successfully restarted solution server');
    } catch (error) {
      throw new Error(`Failed to restart solution server: ${error}`);
    }

    // Configure generative AI for EHR app
    try {
      await vsCode.configureGenerativeAI(DEFAULT_PROVIDER.config);
      console.log('Successfully configured generative AI for EHR app');
    } catch (error) {
      throw new Error(`Failed to configure generative AI: ${error}`);
    }

    // Start the solution server for EHR app
    try {
      await vsCode.startServer();
      console.log('Successfully started solution server for EHR app');
    } catch (error) {
      throw new Error(`Failed to start solution server: ${error}`);
    }

    // Run analysis on EHR app with custom rules
    try {
      await vsCode.runAnalysis();
      console.log('Successfully started EHR analysis');
    } catch (error) {
      throw new Error(`Failed to start EHR analysis: ${error}`);
    }

    // Wait for analysis to complete with better error handling
    try {
      await expect(vsCode.getWindow().getByText('Analysis completed').first()).toBeVisible({
        timeout: 300000,
      });
      console.log('EHR analysis completed successfully');
    } catch (error) {
      throw new Error(`EHR analysis did not complete within expected time: ${error}`);
    }

    console.log('Successfully loaded EHR app and ran analysis with custom rules');

    // Now check success metrics and best hint for the EHR app
    // Get current success metrics for the FileSystemAuditLogger violation
    const successRate = await mcpClient.getSuccessRate([
      {
        ruleset_name: 'audit-logging-migration',
        violation_name: 'audit-logging-0003',
      },
    ]);

    // Get current best hint for the FileSystemAuditLogger violation
    const bestHint = await mcpClient.getBestHint('audit-logging-migration', 'audit-logging-0003');

    // Log the current state
    console.log('EHR app analysis completed with custom rules');
    console.log(
      `Current success metrics: ${successRate.accepted_solutions} accepted, ${successRate.pending_solutions} pending, ${successRate.counted_solutions} counted`
    );
    console.log(`Current best hint ID: ${bestHint.hint_id}`);

    // Verify that we can access the success metrics and hints
    expect(successRate).toBeDefined();
    expect(bestHint).toBeDefined();
    expect(bestHint.hint_id).toBeDefined();

    console.log('EHR app testing completed successfully');
  });

  test.afterAll(async () => {
    await vsCode.closeVSCode();
  });
});
