import process from "node:process";
import path from "node:path";
import fs from "node:fs";

import { italic, gray } from "colorette";

/**
 * Change the process's cwd to the project root (as per the normal location of this file).
 */
export function cwdToProjectRoot() {
  const getProjectRoot = path.resolve(path.dirname(process.argv[1]), "..");
  process.chdir(getProjectRoot);
  console.log(gray(italic(`working from: ${getProjectRoot}`)));
}

/**
 * `chmod` a file or directory to add owner execute permissions.  Same as
 * running `chmod o+x {path}`.
 *
 * @param {string} path File or directory to chmod
 */
export function chmodOwnerPlusX(path) {
  const { mode = fs.constants.S_IRUSR } = fs.statSync(path);
  fs.chmodSync(path, mode | fs.constants.S_IXUSR);
}

/**
 * Fetch the first successful workflow run ID.
 *
 * @param {string} baseUrl - Base URL of the GitHub repository.
 * @param {string} workflowFile - Name of the workflow file.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<string|null>} - ID of the first successful workflow run.
 */
export async function fetchFirstSuccessfulRun(baseUrl, workflowFile, token) {
  try {
    const response = await fetch(
      `${baseUrl}/actions/workflows/${workflowFile}/runs?branch=main&status=success`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch workflow runs: ${response.statusText}`);
    }

    const data = await response.json();
    const runs = data.workflow_runs;
    if (runs.length === 0) {
      console.log("No successful runs found.");
      return null;
    }

    const firstRun = runs[0];
    console.log(`First Successful Workflow Run ID: ${firstRun.id}`);
    return firstRun.id;
  } catch (error) {
    console.error("Error fetching workflow runs:", error.message);
    return null;
  }
}

/**
 * Fetch artifacts for a specific workflow run.
 *
 * @param {string} baseUrl - Base URL of the GitHub repository.
 * @param {string} runId - ID of the workflow run.
 * @param {string} token - GitHub personal access token.
 * @returns {Promise<Array>} - List of artifacts with download URLs.
 */
export async function fetchArtifactsForRun(baseUrl, runId, token) {
  try {
    const response = await fetch(`${baseUrl}/actions/runs/${runId}/artifacts`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch artifacts: ${response.statusText}`);
    }

    const data = await response.json();
    const downloadUrls = data.artifacts.map((artifact) => ({
      name: artifact.name,
      url: artifact.archive_download_url,
    }));
    console.log("Artifact Download URLs:", downloadUrls);
    return downloadUrls;
  } catch (error) {
    console.error("Error fetching artifacts:", error.message);
    return [];
  }
}
