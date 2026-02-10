import { expect, test } from '../../fixtures/test-repo-fixture';
import { VSCode } from '../../pages/vscode.page';
import { HubConfigurationPage } from '../../pages/hub-configuration.page';
import { generateRandomString, getHubConfig } from '../../utilities/utils';
import * as VSCodeFactory from '../../utilities/vscode.factory';
import { KAIViews } from '../../enums/views.enum';
import { FixTypes } from '../../enums/fix-types.enum';

test.describe(
  'LLM Proxy Tests',
  {
    tag: ['@tier3', '@experimental', '@requires-minikube'],
  },
  () => {
    test.skip(
      !process.env.TEST_HUB_URL || !process.env.TEST_HUB_USERNAME || !process.env.TEST_HUB_PASSWORD,
      'LLM proxy tests require TEST_HUB_URL, TEST_HUB_USERNAME, and TEST_HUB_PASSWORD to be set'
    );
    test.setTimeout(600000);

    let vscodeApp: VSCode;
    const profileName = `llm-proxy-${generateRandomString()}`;

    test.beforeAll(async ({ testRepoData }) => {
      const repoInfo = testRepoData['coolstore'];
      vscodeApp = await VSCodeFactory.init(repoInfo.repoUrl, repoInfo.repoName, repoInfo.branch);
      await vscodeApp.createProfile([], repoInfo.targets, profileName);
    });

    test('Verify Hub configuration and solution request', async () => {
      console.log('Configuring Hub connection with profile sync enabled...');
      const hubConfig = getHubConfig({
        url: process.env.TEST_HUB_URL,
        auth: {
          enabled: true,
          username: process.env.TEST_HUB_USERNAME!,
          password: process.env.TEST_HUB_PASSWORD!,
        },
        solutionServerEnabled: false,
        profileSyncEnabled: true,
      });

      const hubConfigPage = await HubConfigurationPage.open(vscodeApp);
      await hubConfigPage.fillForm(hubConfig);
      await vscodeApp.assertNotification('Successfully connected to Hub profile sync');
      console.log('Connected to the Hub');
      await vscodeApp.openAnalysisView();
      await vscodeApp.executeQuickCommand(
        `${VSCode.COMMAND_CATEGORY}: Open the GenAI model provider configuration file`
      );
      await vscodeApp.assertNotification(
        'Local settings are not used when Hub LLM proxy is available.'
      );
      await vscodeApp.executeQuickCommand(
        `${VSCode.COMMAND_CATEGORY}: Open the default the GenAI model provider configuration file and backup the current file`
      );
      await vscodeApp.assertNotification(
        'Local settings are not used when Hub LLM proxy is available.'
      );
      await vscodeApp.startServer();
      await vscodeApp.runAnalysis();
      await vscodeApp.waitForAnalysisCompleted();
      await vscodeApp.searchAndRequestAction('', FixTypes.Incident);
      const resolutionView = await vscodeApp.getView(KAIViews.resolutionDetails);
      await expect(resolutionView.getByText('LLEMULATOR RESPONSE')).toBeVisible();
    });

    test.afterAll(async () => {
      if (!vscodeApp) {
        return;
      }
      const hubPage = await HubConfigurationPage.open(vscodeApp);
      await hubPage.fillForm({
        ...getHubConfig(),
        enabled: false,
      });
      await vscodeApp.closeVSCode();
    });
  }
);
