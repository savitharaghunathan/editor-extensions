#! /usr/bin/env node
import { ensureDir } from "fs-extra/esm";
import { resolve, join } from "path";
import { cwdToProjectRoot } from "./_util.js";
import { downloadAndExtractTarGz, downloadGitHubRelease } from "./_download.js";

cwdToProjectRoot();

// Setup download target
const DOWNLOAD_DIR = resolve("downloaded_assets");
await ensureDir(DOWNLOAD_DIR);

// Download Kai assets
await downloadGitHubRelease({
  targetDirectory: join(DOWNLOAD_DIR, "kai/"),
  metaFile: join(DOWNLOAD_DIR, "kai", "collect.json"),

  org: "konveyor",
  repo: "kai",
  releaseTag: "v0.0.3",

  /*
    Release asset filenames and nodejs equivalent platform/arch
      platform: https://nodejs.org/docs/latest-v22.x/api/process.html#processplatform
      arch: https://nodejs.org/docs/latest-v22.x/api/process.html#processarch
  */
  assets: [
    { name: "kai-rpc-server.linux-x86_64.zip", platform: "linux", arch: "x64", chmod: true },
    { name: "kai-rpc-server.linux-aarch64.zip", platform: "linux", arch: "arm64", chmod: true },
    { name: "kai-rpc-server.macos-x86_64.zip", platform: "darwin", arch: "x64", chmod: true },
    { name: "kai-rpc-server.macos-arm64.zip", platform: "darwin", arch: "arm64", chmod: true },
    { name: "kai-rpc-server.windows-x64.zip", platform: "win32", arch: "x64" },
    { name: "kai-rpc-server.windows-arm64.zip", platform: "win32", arch: "arm64" },
  ],
});

// Download jdt.ls
// Base release url: https://download.eclipse.org/jdtls/milestones/1.38.0/
await downloadAndExtractTarGz({
  targetDirectory: join(DOWNLOAD_DIR, "jdt.ls-1.38.0/"),
  url: "https://download.eclipse.org/jdtls/milestones/1.38.0/jdt-language-server-1.38.0-202408011337.tar.gz",
  sha256: "ba697788a19f2ba57b16302aba6b343c649928c95f76b0d170494ac12d17ac78",
});
