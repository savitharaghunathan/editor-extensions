import { generateRandomString, getOSInfo } from './e2e/utilities/utils';
import { KAIViews } from './e2e/enums/views.enum';
import * as VSCodeFactory from './e2e/utilities/vscode.factory';

async function globalSetup() {
  const repoUrl = process.env.TEST_REPO_URL ?? 'https://github.com/konveyor-ecosystem/coolstore';
  const repoName = process.env.TEST_REPO_NAME ?? 'coolstore';
  console.log('Running global setup...');
  const vscodeApp = await VSCodeFactory.init(repoUrl, repoName);

  if (getOSInfo() === 'windows' && process.env.CI) {
    await vscodeApp.getWindow().waitForTimeout(60000);
  }
  const javaReadySelector = vscodeApp.getWindow().getByRole('button', { name: 'Java: Ready' });
  await javaReadySelector.waitFor({ timeout: 120000 });
  // Sometimes the java ready status is displayed for a few seconds before starting to load again
  // This checks that the state is kept for a few seconds before continuing
  await vscodeApp.waitDefault();
  await javaReadySelector.waitFor({ timeout: 1200000 });
  await vscodeApp.openAnalysisView();
  await vscodeApp.closeVSCode();
  console.log('Completed global setup.');

  if (getOSInfo() === 'windows' && process.env.CI) {
    const vscodeApp = await VSCodeFactory.open(repoUrl, repoName);
    await vscodeApp.createProfile([], ['openjdk17'], generateRandomString());
    await vscodeApp.configureGenerativeAI();
    await vscodeApp.openAnalysisView();
    const analysisView = await vscodeApp.getView(KAIViews.analysisView);
    console.log('Starting server...');
    const startButton = analysisView.getByRole('button', { name: 'Start' });
    await startButton.waitFor({ state: 'visible', timeout: 10000 });
    await startButton.click({ delay: 500 });
    await vscodeApp.getWindow().waitForTimeout(60000);
    await vscodeApp.closeVSCode();
  }
}

export default globalSetup;
