import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.ci') });

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: 'test-output',
  globalSetup: require.resolve('./global.setup.ts'),
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120000,
  reporter: 'line',
  expect: {
    timeout: 10000,
  },
  use: {
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure', // Not yet supported on Electron https://github.com/microsoft/playwright/issues/8208
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--window-size=1920,1080', '--start-maximized'],
    },
  },
  projects: [
    {
      name: 'base',
      testMatch: ['**/base/**/*.test.ts'],
    },
    {
      name: 'solution-server-tests',
      testMatch: ['**/solution-server/**/*.test.ts'],
    },
    {
      name: 'analysis-tests',
      testMatch: /.*analyze.+\.test\.ts/,
      dependencies: ['base'],
    },
    {
      name: 'agent-flow-tests',
      testMatch: /.*agent_flow.+\.test\.ts/,
    },
  ],
});
