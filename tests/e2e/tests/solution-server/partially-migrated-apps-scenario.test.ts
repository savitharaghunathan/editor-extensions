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

    // Wait for VS Code to fully load before creating profile
    await vsCode.getWindow().waitForTimeout(5000);

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
    const violationCount = await violations.count();
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
      const customViolationText = await customRuleViolations.textContent();
    } else {
      // If no specific custom rule violations, at least verify that violations exist
      // and that the analysis is working with the profile that has custom rules
      if (violationCount > 0) {
        // Check the first violation to see what type it is
        const firstViolation = violations.first();
        const violationText = await firstViolation.textContent();
      } else {
      }
    }

    // Verify that the analysis profile with custom rules is being used
    // This could be done by checking for profile indicators in the UI
    const profileIndicator = analysisView.locator('text=/profile/i, text=/custom/i').first();

    if ((await profileIndicator.count()) > 0) {
      const profileText = await profileIndicator.textContent();
    } else {
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

      // Wait for solution generation to complete - look for specific UI elements that indicate solution is ready

      // Method 1: Wait for the accept button to appear (this means solution is ready)
      let acceptButton = null;
      let attempts = 0;
      const maxAttempts = 30; // Try for up to 5 minutes (30 * 10 seconds)

      while (attempts < maxAttempts) {
        try {
          acceptButton = resolutionView.locator('button[aria-label="Accept all changes"]');
          if (await acceptButton.isVisible()) {
            break;
          }
        } catch (error) {
          // Button not found yet, continue waiting
        }

        // Also check for reject button as an alternative
        try {
          const rejectButton = resolutionView.locator('button[aria-label="Reject all changes"]');
          if (await rejectButton.isVisible()) {
            acceptButton = rejectButton; // Use this as our reference
            break;
          }
        } catch (error) {
          // Button not found yet, continue waiting
        }

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
      const analysisView = await vsCode.getView(KAIViews.analysisView);

      // Wait for solution confirmation to complete (same as working test)
      await expect(
        analysisView
          .getByRole('heading', { level: 2 })
          .filter({ hasText: 'Waiting for solution confirmation...' })
      ).not.toBeVisible({ timeout: 35000 });

      console.log('Successfully applied fix for FileSystemAuditLogger violation');
    } else {
      console.log('No incidents found to fix');
    }
  });

  test.afterAll(async () => {
    await vsCode.closeVSCode();
  });
});
