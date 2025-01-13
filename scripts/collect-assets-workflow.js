#! /usr/bin/env node
import { ensureDir } from "fs-extra/esm";
import { resolve, join } from "path";
import { cwdToProjectRoot } from "./_util.js";
import { downloadWorkflowArtifacts, downloadAndExtractTarGz } from "./_download.js";
import dotenv from "dotenv";
dotenv.config();

const REPO_OWNER = "konveyor";
const REPO_NAME = "kai";
const WORKFLOW_FILE = "build-and-push-binaries.yml";

const GITHUB_API = "https://api.github.com";
const BASE_URL = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}`;
const DOWNLOAD_DIR = resolve("downloaded_assets");
const META_FILE = join(DOWNLOAD_DIR, "kai", "collect.json");

cwdToProjectRoot();

await ensureDir(DOWNLOAD_DIR);

// Download Kai assets via workflow artifacts
await downloadWorkflowArtifacts({
  targetDirectory: join(DOWNLOAD_DIR, "kai/"),
  metaFile: META_FILE,
  url: BASE_URL,
  workflow: WORKFLOW_FILE,
  assets: [
    { name: "java-deps.zip" },
    { name: "kai-rpc-server.linux-aarch64.zip", platform: "linux", arch: "arm64", chmod: true },
    { name: "kai-rpc-server.linux-x86_64.zip", platform: "linux", arch: "x64", chmod: true },
    { name: "kai-rpc-server.macos-arm64.zip", platform: "darwin", arch: "arm64", chmod: true },
    { name: "kai-rpc-server.macos-x86_64.zip", platform: "darwin", arch: "x64", chmod: true },
    { name: "kai-rpc-server.windows-Arm64.zip", platform: "win32", arch: "arm64" },
    { name: "kai-rpc-server.windows-X64.zip", platform: "win32", arch: "x64" },
  ],
});

// Download jdt.ls
// Base release url: https://download.eclipse.org/jdtls/milestones/1.38.0/
await downloadAndExtractTarGz({
  targetDirectory: join(DOWNLOAD_DIR, "jdt.ls-1.38.0/"),
  url: "https://download.eclipse.org/jdtls/milestones/1.38.0/jdt-language-server-1.38.0-202408011337.tar.gz",
  sha256: "ba697788a19f2ba57b16302aba6b343c649928c95f76b0d170494ac12d17ac78",
});
