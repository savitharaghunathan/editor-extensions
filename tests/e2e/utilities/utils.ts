import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import type { TestInfo } from '@playwright/test';
import { rm } from 'node:fs/promises';
import process from 'process';

export const extensionName = process.env.EXTENSION_NAME || 'konveyor';
export const extensionPublisher = process.env.EXTENSION_PUBLISHER || 'konveyor';
export const extensionId = `${extensionPublisher}.${extensionName}`;
export const extensionShortName = process.env.TEST_CATEGORY || 'Konveyor';

// Function to get the analysis view title based on extension short name
export function getAnalysisViewTitle(): string {
  return `${extensionShortName} Analysis View`;
}

// Function to get OS information
export function getOSInfo(): string {
  const platform: NodeJS.Platform = os.platform();

  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macOS';
    case 'linux':
      return 'linux';
    default:
      return `Unknown OS: ${platform}`;
  }
}

export async function cleanupRepo(repoDir: string) {
  if (!repoDir) {
    console.debug(`Directory ${repoDir} does not exist, skipping cleanup.`);
    return;
  }
  const repoPath = path.resolve(process.cwd(), repoDir);
  if (!fs.existsSync(repoPath)) {
    console.debug(`cleanupRepo: Directory ${repoPath} does not exist. Skipping cleanup.`);
    return;
  }

  try {
    await rm(repoPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 5000,
    });
    console.debug(`cleanupRepo: Successfully deleted directory ${repoPath}`);
  } catch (error) {
    console.error('Error while cleaning up cloned repository:', error);
  }
}

export async function uninstallExtension() {
  try {
    execSync(`code --uninstall-extension ${extensionId}`, {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Error uninstalling Konveyor extension:', error);
  }
}

export function getVscodeExecutablePath() {
  return getOSInfo() === 'windows'
    ? process.env.WINDOWS_VSCODE_EXECUTABLE_PATH
    : process.env.VSCODE_EXECUTABLE_PATH || '/usr/share/code/code';
}

export function getRepoName(testInfo: TestInfo): string {
  const repoName = path.basename(testInfo.file).replace('.test.ts', '');
  const parts = repoName.split('_');
  if (parts.length < 2) {
    throw new Error(
      `Invalid test file name format: ${testInfo.file}. Expected format: prefix_reponame.test.ts`
    );
  }
  return parts[parts.length - 1];
}

export function generateRandomString(length: number = 8): string {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

export function writeOrUpdateSettingsJson(settingsPath: string, settings: Record<string, any>) {
  try {
    const vscodeDir = path.dirname(settingsPath);
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    let existingSettings: Record<string, any> = {};
    if (fs.existsSync(settingsPath)) {
      try {
        const existingContent = fs.readFileSync(settingsPath, 'utf-8');
        existingSettings = JSON.parse(existingContent);
      } catch (parseError) {
        console.warn(
          `Failed to parse existing settings.json, starting with empty settings: ${parseError}`
        );
        existingSettings = {};
      }
    }
    const mergedSettings = { ...existingSettings, ...settings };
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing VSCode settings:', error);
    throw error;
  }
}
