#! /usr/bin/env node
import { ensureDir } from "fs-extra/esm";
import { resolve, join } from "path";
import { cwdToProjectRoot } from "./_util.js";
import { downloadWorkflowArtifacts, downloadAndExtractTarGz } from "./_download.js";
import dotenv from "dotenv";
dotenv.config();

const DOWNLOAD_DIR = resolve("downloaded_assets");

cwdToProjectRoot();

await ensureDir(DOWNLOAD_DIR);

// Download Kai assets via workflow artifacts
await downloadWorkflowArtifacts({
  targetDirectory: join(DOWNLOAD_DIR, "kai/"),
  metaFile: join(DOWNLOAD_DIR, "kai", "collect.json"),
  org: "konveyor",
  repo: "kai",
  workflow: "build-and-push-binaries.yml",
  assets: [
    { name: "java-deps.zip", chmod: false },
    { name: "kai-rpc-server.linux-aarch64.zip", platform: "linux", arch: "arm64", chmod: true },
    { name: "kai-rpc-server.linux-x86_64.zip", platform: "linux", arch: "x64", chmod: true },
    { name: "kai-rpc-server.macos-arm64.zip", platform: "darwin", arch: "arm64", chmod: true },
    { name: "kai-rpc-server.macos-x86_64.zip", platform: "darwin", arch: "x64", chmod: true },
    { name: "kai-rpc-server.windows-Arm64.zip", platform: "win32", arch: "arm64", chmod: false },
    { name: "kai-rpc-server.windows-X64.zip", platform: "win32", arch: "x64", chmod: false },
  ],
});

// Download jdt.ls
// Base release url: https://download.eclipse.org/jdtls/milestones/1.38.0/
await downloadAndExtractTarGz({
  targetDirectory: join(DOWNLOAD_DIR, "jdt.ls-1.38.0/"),
  url: "https://download.eclipse.org/jdtls/milestones/1.38.0/jdt-language-server-1.38.0-202408011337.tar.gz",
  sha256: "ba697788a19f2ba57b16302aba6b343c649928c95f76b0d170494ac12d17ac78",
});
