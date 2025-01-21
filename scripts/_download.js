import { join, extname, basename } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import fs from "fs-extra";
import unzipper from "unzipper";
import * as tar from "tar";
import { bold, green, yellow } from "colorette";
import { chmodOwnerPlusX } from "./_util.js";
import { fetchFirstSuccessfulRun, fetchArtifactsForRun } from "./_github.js";

import { globby } from "globby";

const GITHUB_API = "https://api.github.com";

/**
 * Fetch the JSON metadata for a GitHub repository release.
 *
 * @param {string} org GitHub organization/user for the release
 * @param {string} repo GitHub repository for the release
 * @param {string} releaseTag The release's tag
 * @returns {object}
 */
export async function getGitHubReleaseMetadata(org, repo, releaseTag) {
  try {
    const url = `${GITHUB_API}/repos/${org}/${repo}/releases/tags/${releaseTag}`;
    console.log(
      `Fetching GitHub release metadata for ${yellow(`${org}/${repo}`)} release: ${yellow(releaseTag)}`,
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch release metadata: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Error in getGitHubReleaseMetadata: ${error.message}`);
  }
}

/**
 * Fetch the commit sha for a GitHub repository release.
 *
 * @param {string} org GitHub organization/user for the release
 * @param {string} repo GitHub repository for the release
 * @param {string} releaseTag The release's tag
 * @returns The release tag's commit sha
 */
export async function getGitHubReleaseTagSha(org, repo, releaseTag) {
  try {
    const url = `${GITHUB_API}/repos/${org}/${repo}/commits/${releaseTag}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.sha",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch release tag sha: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Error in getGitHubReleaseTagSha: ${error.message}`);
  }
}

/**
 * @param {string} targetFile
 * @param {Response} fetchResponse
 * @returns {Promise<string>} sha256 hash of the response data
 */
async function streamResponseToFile(targetFile, fetchResponse) {
  try {
    const reader = Readable.fromWeb(fetchResponse.body);

    // setup stream to file
    const fileStream = fs.createWriteStream(targetFile);
    const pipeToFile = pipeline(reader, fileStream);

    // setup stream to calculate the sha256 hash of the file
    const hash = createHash("sha256");
    const pipeToHash = pipeline(reader, hash);

    // run them both, reject if either rejects, resolve with the hash
    await Promise.all([pipeToFile, pipeToHash]);
    return hash.digest("hex");
  } catch (error) {
    throw new Error(`Error in streamResponseToFile: ${error.message}`);
  }
}

export async function downloadAndExtractGitHubAsset(
  target,
  gitHubReleaseAsset,
  platform,
  arch,
  chmod = false,
) {
  try {
    const assetDir = join(target, `${platform}-${arch}`);
    const assetFileName = join(assetDir, gitHubReleaseAsset.name);

    await fs.ensureDir(assetDir);

    console.log(`Downloading asset: ${gitHubReleaseAsset.name}`);
    const response = await fetch(gitHubReleaseAsset.browser_download_url);
    if (!response.ok) {
      throw new Error(`Failed to download ${gitHubReleaseAsset.name}: ${response.statusText}`);
    }
    const sha256 = await streamResponseToFile(assetFileName, response);

    console.log(`Asset sha256: ${green(sha256)}`);
    console.log(`Extracting to: ${assetDir}`);
    const zipFile = await unzipper.Open.file(assetFileName);
    await zipFile.extract({ path: assetDir });

    const extractedFiles = await fs.readdir(assetDir);
    for (const file of extractedFiles) {
      if (chmod && extname(file) !== ".zip") {
        chmodOwnerPlusX(join(assetDir, file));
      }
    }

    console.log(`Extracted: ${gitHubReleaseAsset.name}`);
  } catch (error) {
    throw new Error(`Error in downloadAndExtractGitHubAsset: ${error.message}`);
  }
}

export async function downloadGitHubRelease({
  targetDirectory,
  metaFile,
  org,
  repo,
  releaseTag,
  assets,
}) {
  try {
    const releaseData = await getGitHubReleaseMetadata(org, repo, releaseTag);
    const commitId = await getGitHubReleaseTagSha(org, repo, releaseTag);
    const releaseAssets = releaseData.assets;

    const metadata = {
      org,
      repo,
      releaseTag,
      commitId,
      collectedAt: new Date().toISOString(),
      assets: [],
    };

    for (const { name, platform, arch, chmod } of assets) {
      const releaseAsset = releaseAssets.find((a) => a.name.toLowerCase() === name.toLowerCase());
      if (releaseAsset) {
        try {
          console.group(yellow(releaseAsset.name));
          await downloadAndExtractGitHubAsset(targetDirectory, releaseAsset, platform, arch, chmod);
        } finally {
          console.groupEnd();
        }
        metadata.assets.push({
          name: releaseAsset.name,
          platform,
          arch,
          chmod: !!chmod,
          updatedAt: releaseAsset.updated_at,
        });
      } else {
        console.warn(`Asset [${name}] was not found in GitHub release ${releaseData.html_url}`);
      }
    }

    await fs.writeJson(metaFile, metadata, { spaces: 2 });
    console.log(`Metadata written to ${metaFile}`);
    console.log(`All assets downloaded to: ${targetDirectory}`);
  } catch (error) {
    throw new Error(`Error in downloadGitHubRelease: ${error.message}`);
  }
}

export async function downloadAndExtractTarGz({ targetDirectory, url, sha256 }) {
  try {
    console.group(yellow(url));
    console.log(bold("Download:"), url, bold("To:"), targetDirectory);
    await fs.ensureDir(targetDirectory);

    // Download the tar.gz file
    const fileName = basename(new URL(url).pathname);
    const targetFile = join(targetDirectory, fileName);

    console.log("Downloading:", yellow(fileName));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }
    const downloadSha256 = await streamResponseToFile(targetFile, response);

    // If a sha256 is provided, verify against the downloaded file
    console.log(`Asset sha256: ${green(downloadSha256)}`);
    if (sha256 && downloadSha256 !== sha256) {
      throw new Error(
        `Downloaded file ${targetFile} sha256 ${downloadSha256} does not match the expected sha256 ${sha256}`,
      );
    }

    // Extract the tar.gz file
    console.log(`Extracting to ${targetDirectory}`);
    await tar.extract({
      f: targetFile,
      z: true,
      cwd: targetDirectory,
    });
  } catch (error) {
    throw new Error(`Error in downloadAndExtractTarGz: ${error.message}`);
  } finally {
    console.groupEnd();
  }
}

/**
 * Download a workflow artifact from GitHub
 *
 * @param {string} url - Download URL for the artifact
 * @param {string} name - Name of the artifact file
 * @param {string} outputDir - Directory to save the downloaded artifact
 * @returns {Promise<string>} - Path to the downloaded artifact file
 */
export async function downloadArtifact(url, name, outputDir, token) {
  try {
    const assetDir = join(outputDir);
    const assetFileName = join(assetDir, `${name}`);
    await fs.ensureDir(assetDir);

    console.log(`Downloading asset: ${name}`);
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download ${name}: ${response.statusText}`);
    }

    const sha256 = await streamResponseToFile(assetFileName, response);
    console.log(`Verifying download of: ${name}`);
    console.log(`Asset sha256: ${green(sha256)}`);

    console.log(`Downloaded ${name} to ${assetFileName}`);
    return assetFileName;
  } catch (error) {
    throw new Error(`Error in downloadArtifact: ${error.message}`);
  }
}

/**
 * Extract an artifact ZIP file.
 *
 * @param {string} filePath - Path to the ZIP file
 * @param {string} tempDir - Temporary directory for extraction
 * @param {string} finalDir - Final directory for extracted files
 */
export async function extractArtifact(filePath, tempDir, finalDir) {
  try {
    console.log(`Checking if ${filePath} is a valid ZIP archive.`);

    // First extraction to temporary directory
    console.log(`Extracting ${filePath} to temporary directory: ${tempDir}`);
    const unzipArtifact = await unzipper.Open.file(filePath);
    await unzipArtifact.extract({ path: tempDir });

    // Find and extract any nested zip files in the temp directory
    const zipFiles = await globby("*.zip", { cwd: tempDir });
    for (const file of zipFiles) {
      const nestedZipPath = join(tempDir, file);
      console.log(`Extracting nested zip: ${nestedZipPath} to ${finalDir}`);

      const unzipNestedArtifact = await unzipper.Open.file(nestedZipPath);
      await unzipNestedArtifact.extract({ path: finalDir });

      console.log(`Deleting nested zip: ${nestedZipPath}`);
      await fs.unlink(nestedZipPath);
    }

    // Cleanup temporary directory
    console.log(`Cleaning up temporary directory: ${tempDir}`);
    await fs.rm(tempDir, { recursive: true, force: true });

    // Cleanup the original zip file
    console.log(`Deleting original zip file: ${filePath}`);
    await fs.unlink(filePath);

    console.log(`Extraction complete: ${filePath} -> ${finalDir}`);
  } catch (error) {
    console.error(`Error extracting artifact at ${filePath}:`, error.message);
    throw new Error(`Failed to extract artifact: ${error.message}`);
  }
}

/**
 * Download and process workflow artifacts.
 *
 * @param {string} targetDirectory - Directory to store downloaded artifacts
 * @param {string} metaFile - Path to the metadata file
 * @param {string} org - GH org
 * @param {string} repo - GH repo
 * @param {string} workflow - Name of the workflow file
 * @param {Array} assets - List of assets to download
 */
export async function downloadWorkflowArtifacts({
  targetDirectory,
  metaFile,
  org,
  repo,
  workflow,
  assets,
}) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    const errorMessage = "GITHUB_TOKEN environment variable is not set.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  try {
    console.log("Fetching first successful workflow run...");
    const { workflowRunId, headSha } = await fetchFirstSuccessfulRun(org, repo, workflow);

    if (!workflowRunId) {
      throw new Error("No successful workflow runs found.");
    }

    console.log(`Workflow Run ID: ${workflowRunId}`);
    const artifactUrls = await fetchArtifactsForRun(org, repo, workflowRunId);

    if (!artifactUrls || artifactUrls.length === 0) {
      throw new Error("No artifacts found for the workflow run.");
    }

    const metadata = {
      org,
      repo,
      workflow,
      workflowRunId,
      commitId: headSha,
      collectedAt: new Date().toISOString(),
      assets: [],
    };

    for (const asset of assets) {
      const { name } = asset;
      const artifact = artifactUrls.find((a) => a.name === name);

      if (!artifact) {
        console.warn(`Asset [${name}] was not found in the workflow artifacts.`);
        continue;
      }

      try {
        console.log(`Processing artifact: ${name}`);

        const downloadedFilePath = await downloadArtifact(
          artifact.url,
          name,
          targetDirectory,
          GITHUB_TOKEN,
        );

        // Extract the artifact
        const tempDir = join(targetDirectory, "temp");
        const extractionDir = join(targetDirectory, name.replace(/\.zip$/, ""));
        await extractArtifact(downloadedFilePath, tempDir, extractionDir);

        for (const file of await globby(["*", "!*.zip"], { cwd: extractionDir, absolute: true })) {
          chmodOwnerPlusX(file);
        }

        metadata.assets.push({
          name,
          extractionDir,
          downloadedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error processing artifact [${name}]:`, error.message);
        throw new Error(`Failed to process artifact ${name}: ${error.message}`);
      }
    }

    await fs.writeJson(metaFile, metadata, { spaces: 2 });
    console.log(`Metadata written to ${metaFile}`);
  } catch (error) {
    console.error("Error downloading workflow artifacts:", error.message);
    throw new Error(`Failed to download workflow artifacts: ${error.message}`);
  }
}
