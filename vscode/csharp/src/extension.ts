import * as vscode from "vscode";
import { exec } from "node:child_process";
import winston from "winston";
import { OutputChannelTransport } from "winston-transport-vscode";
import * as rpc from "vscode-jsonrpc/node";
import type { KonveyorCoreApi } from "@editor-extensions/shared";
import { CSharpExternalProviderManager } from "./csharpExternalProviderManager";

const EXTENSION_DISPLAY_NAME = "Konveyor C#";
const EXTENSION_ID = "konveyor.konveyor-csharp";

export async function activate(context: vscode.ExtensionContext) {
  // Setup logger
  const outputChannel = vscode.window.createOutputChannel(EXTENSION_DISPLAY_NAME);
  const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.File({
        filename: vscode.Uri.joinPath(context.logUri, "csharp-extension.log").fsPath,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 3,
      }),
      new OutputChannelTransport({
        outputChannel,
      }),
    ],
  });

  logger.info("Logger created");
  logger.info(`Extension ${EXTENSION_ID} starting`);

  // Check if .NET SDK is available (optional but recommended)
  await new Promise<void>((resolve) => {
    exec("dotnet --version", { timeout: 5000 }, (error, stdout, _stderr) => {
      if (error) {
        logger.warn(".NET SDK not found in PATH", { error: error.message });
        vscode.window.showWarningMessage(
          ".NET SDK was not found in your PATH. " +
            "While not strictly required for source-only analysis, " +
            "having .NET SDK installed can improve analysis quality. " +
            "Please install .NET SDK from https://dotnet.microsoft.com/download",
        );
      } else {
        const version = stdout.trim();
        logger.info(`.NET SDK detected: ${version}`);
      }
      resolve();
    });
  });

  // Get core extension API
  const coreExtension = vscode.extensions.getExtension("konveyor.konveyor");
  if (!coreExtension) {
    const message = "Konveyor C# extension requires Konveyor Core extension to be installed";
    logger.error(message);
    vscode.window.showErrorMessage(message);
    return;
  }

  logger.info("Found Konveyor Core extension, activating...");

  let coreApi: KonveyorCoreApi;
  try {
    coreApi = await coreExtension.activate();
  } catch (err) {
    const message = "Failed to activate Konveyor Core extension.";
    logger.error(message, err);
    vscode.window.showErrorMessage(message);
    return;
  }

  // Create socket path for C# provider communication
  const providerSocketPath = rpc.generateRandomPipeName(); // GRPC socket for c-sharp-analyzer-provider

  logger.info("Socket path generated", {
    providerSocket: providerSocketPath,
  });

  // Start C# analyzer provider subprocess
  let providerManager: CSharpExternalProviderManager;

  try {
    providerManager = new CSharpExternalProviderManager(providerSocketPath, context, logger);
    await providerManager.start();
    context.subscriptions.push(providerManager);
  } catch (err) {
    const message =
      "Failed to start c-sharp-analyzer-provider. C# analysis will be disabled. " +
      `Error: ${err instanceof Error ? err.message : String(err)}`;
    logger.error(message, err);
    vscode.window.showWarningMessage(
      "C# analyzer provider could not start. C# analysis will be disabled.",
    );
    return;
  }

  // Get workspace location for analysis
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const workspaceLocation = workspaceFolder?.uri.fsPath || process.cwd();

  // Format provider address for GRPC
  // Windows named pipes: unix:\\.\pipe\vscode-ipc-123
  // Unix domain sockets: unix:///tmp/vscode-ipc-123.sock
  const providerAddress = `unix://${providerSocketPath}`;

  logger.info("Provider configuration", {
    providerAddress,
    workspaceLocation,
  });

  // Register C# provider with core
  const providerDisposable = coreApi.registerProvider({
    name: "csharp",
    providerConfig: {
      name: "dotnet",
      address: providerAddress, // GRPC socket address
      useSocket: true,
      initConfig: [
        {
          location: workspaceLocation,
          analysisMode: "source-only",
          pipeName: "", // C# provider doesn't use LSP proxy, but field is required
          providerSpecificConfig: {
            // Add any C#-specific configuration here
            // For example: framework targets, project files to analyze, etc.
          },
        },
      ],
      contextLines: 10,
    },
    rulesetsPaths: [
      // In Phase 1, rulesets are still in core extension
      // Will be moved to C# extension in later phase if needed
    ],
  });

  context.subscriptions.push(providerDisposable);

  // Subscribe to analysis completion events
  const analysisCompleteDisposable = coreApi.onAnalysisComplete((results) => {
    logger.info("Analysis complete", results);
  });

  context.subscriptions.push(analysisCompleteDisposable);

  logger.info("Konveyor C# extension activated and registered with core", {
    providerSocket: providerSocketPath,
    workspaceLocation,
  });
}

export function deactivate() {
  console.log("Konveyor C# extension is now deactivated");
}
