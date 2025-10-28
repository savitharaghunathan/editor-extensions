import { ExtensionState } from "../../extensionState";
import * as vscode from "vscode";
import { ChatMessageType, ModifiedFileMessageValue } from "@editor-extensions/shared";
import { executeExtensionCommand } from "../../commands";
import { runPartialAnalysis } from "../../analysis/runAnalysis";
import { KaiWorkflowMessageType, KaiUserInteraction } from "@editor-extensions/agentic";

/**
 * Creates a new file with the specified content
 */
const createNewFile = async (
  uri: vscode.Uri,
  filePath: string,
  content: string,
  state: ExtensionState,
): Promise<void> => {
  try {
    // Ensure the directory structure exists
    const directoryPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (directoryPath) {
      const directoryUri = vscode.Uri.file(directoryPath);
      try {
        await vscode.workspace.fs.createDirectory(directoryUri);
      } catch (dirError) {
        state.logger
          .child({ component: "handleFileResponse.createNewFile" })
          .error(`Failed to create directory at ${directoryPath}:`, dirError);
      }
    }
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    vscode.window.showInformationMessage(
      `Created new file ${vscode.workspace.asRelativePath(uri)}`,
    );
  } catch (error) {
    state.logger
      .child({ component: "handleFileResponse.createNewFile" })
      .error(`Failed to create file at ${filePath}:`, error);
    throw new Error(`Failed to create file: ${error}`);
  }
};

/**
 * Updates an existing file with new content
 */
const updateExistingFile = async (
  uri: vscode.Uri,
  filePath: string,
  content: string,
  state: ExtensionState,
): Promise<void> => {
  try {
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
    vscode.window.showInformationMessage(`Updated file ${vscode.workspace.asRelativePath(uri)}`);
  } catch (error) {
    state.logger
      .child({ component: "handleFileResponse.updateExistingFile" })
      .error(`Failed to update file at ${filePath}:`, error);
    throw new Error(`Failed to update file: ${error}`);
  }
};

/**
 * Deletes a file if it exists
 */
const deleteFile = async (
  uri: vscode.Uri,
  filePath: string,
  state: ExtensionState,
): Promise<void> => {
  try {
    let fileExists = false;
    try {
      await vscode.workspace.fs.stat(uri);
      fileExists = true;
    } catch (statError) {
      state.logger
        .child({ component: "handleFileResponse.deleteFile" })
        .warn(`File at ${filePath} does not exist or cannot be accessed`, statError);
      fileExists = false;
    }

    if (fileExists) {
      await vscode.workspace.fs.delete(uri);
      vscode.window.showInformationMessage(`Deleted file ${vscode.workspace.asRelativePath(uri)}`);
    }
  } catch (error) {
    state.logger
      .child({ component: "handleFileResponse.deleteFile" })
      .error(`Failed to delete file at ${filePath}:`, error);
    throw new Error(`Failed to delete file: ${error}`);
  }
};

export async function handleFileResponse(
  messageToken: string,
  responseId: string,
  path: string,
  content: string | undefined,
  state: ExtensionState,
): Promise<void> {
  const logger = state.logger.child({ component: "handleFileResponse.handleFileResponse" });
  try {
    const messageIndex = state.data.chatMessages.findIndex(
      (msg) => msg.messageToken === messageToken,
    );

    if (messageIndex === -1) {
      state.logger
        .child({ component: "handleFileResponse.handleFileResponse" })
        .error("Message token not found:", messageToken);
      return;
    }

    if (responseId === "apply") {
      const uri = vscode.Uri.file(path);
      const fileMessage = state.data.chatMessages.find(
        (msg) =>
          msg.kind === ChatMessageType.ModifiedFile &&
          msg.messageToken === messageToken &&
          (msg.value as ModifiedFileMessageValue).path === path,
      );

      if (!fileMessage) {
        throw new Error(`No changes found for file: ${path}`);
      }

      const fileValue = fileMessage.value as ModifiedFileMessageValue;
      const isNew = fileValue.isNew;
      const isDeleted = fileValue.isDeleted;

      const fileContent = content || fileValue.content;

      try {
        if (isDeleted) {
          await deleteFile(uri, path, state);
        } else if (isNew) {
          await createNewFile(uri, path, fileContent, state);
        } else {
          await updateExistingFile(uri, path, fileContent, state);
        }

        // Trigger analysis after file changes are applied in agentic mode or when analyze on save is enabled
        // This ensures that the tasks interaction can detect new diagnostic issues
        try {
          await runPartialAnalysis(state, [uri]);
        } catch (analysisError) {
          logger.warn(
            `Failed to trigger analysis after applying changes to ${path}:`,
            analysisError,
          );
          // Don't throw here - file changes were successful, analysis failure is not critical
        }
      } catch (error) {
        logger.error("Error applying file changes:", error);
        vscode.window.showErrorMessage(`Failed to apply changes: ${error}`);
        throw error;
      }

      // Notify solution server of the change
      try {
        if (isDeleted) {
          await executeExtensionCommand("changeDiscarded", path);
        } else {
          await executeExtensionCommand("changeApplied", path, fileContent);
        }
      } catch (error) {
        logger.error("Error notifying solution server:", error);
      }

      // Update the chat message status in the centralized state (for Accept/Reject All consistency)
      state.mutateData((draft) => {
        const messageIndex = draft.chatMessages.findIndex(
          (msg) => msg.messageToken === messageToken,
        );
        if (
          messageIndex >= 0 &&
          draft.chatMessages[messageIndex].kind === ChatMessageType.ModifiedFile
        ) {
          const modifiedFileMessage = draft.chatMessages[messageIndex]
            .value as ModifiedFileMessageValue;
          modifiedFileMessage.status = "applied";
        }
      });
    } else if (responseId === "noChanges") {
      state.mutateData((draft) => {
        const messageIndex = draft.chatMessages.findIndex(
          (msg) => msg.messageToken === messageToken,
        );
        if (
          messageIndex >= 0 &&
          draft.chatMessages[messageIndex].kind === ChatMessageType.ModifiedFile
        ) {
          const modifiedFileMessage = draft.chatMessages[messageIndex]
            .value as ModifiedFileMessageValue;
          modifiedFileMessage.status = "no_changes_needed";
        }
      });
    } else {
      // For reject, notify the solution server that the change was discarded
      try {
        await executeExtensionCommand("changeDiscarded", path);
      } catch (error) {
        logger.error("Error notifying solution server of rejection:", error);
      }
      state.mutateData((draft) => {
        const messageIndex = draft.chatMessages.findIndex(
          (msg) => msg.messageToken === messageToken,
        );
        if (
          messageIndex >= 0 &&
          draft.chatMessages[messageIndex].kind === ChatMessageType.ModifiedFile
        ) {
          const modifiedFileMessage = draft.chatMessages[messageIndex]
            .value as ModifiedFileMessageValue;
          modifiedFileMessage.status = "rejected";
        }
      });
    }

    const fileMessage = state.data.chatMessages.find(
      (msg) => msg.kind === ChatMessageType.ModifiedFile && msg.messageToken === messageToken,
    );

    logger.debug(`[handleFileResponse] Found fileMessage for token ${messageToken}:`, {
      found: !!fileMessage,
      value: fileMessage?.value,
    });

    const fileMessageValue = fileMessage ? (fileMessage.value as ModifiedFileMessageValue) : null;
    const hasUserInteraction = fileMessageValue?.userInteraction;

    // Resolve the workflow interaction for modifiedFile type
    // This is needed to complete the promise-based flow in the agentic workflow
    // Only attempt to access workflow if it's initialized (agent mode)
    if (state.workflowManager?.isInitialized) {
      try {
        const workflow = state.workflowManager.getWorkflow();

        // Build the data object conditionally
        const interactionData: KaiUserInteraction = {
          type: "modifiedFile",
          systemMessage: {},
        };

        // Only add response field if there's user interaction
        if (hasUserInteraction) {
          interactionData.response = {
            yesNo: responseId === "apply",
          };
        }

        await workflow.resolveUserInteraction({
          id: messageToken || fileMessageValue?.messageToken || "",
          type: KaiWorkflowMessageType.UserInteraction,
          data: interactionData,
        });
      } catch (error) {
        logger.error("Error resolving workflow interaction:", error);
      }
    }

    // Also resolve the pending interaction with the UserInteraction ID
    if (state.resolvePendingInteraction) {
      const resolved = state.resolvePendingInteraction(messageToken, {
        responseId: responseId,
        path: path,
      });

      if (!resolved) {
        logger.debug(`No pending interaction found for UserInteraction ID: ${messageToken}`);
      }
    }

    if (!fileMessageValue) {
      logger.warn(`Could not find UserInteraction ID for ModifiedFile message: ${messageToken}`);
    }

    // The pending interaction for ModifiedFile ID is no longer created since we only
    // create pending interactions for UserInteraction messages now
  } catch (error) {
    logger.error("Error handling file response:", error);
    vscode.window.showErrorMessage(`Failed to handle file response: ${error}`);
    throw error;
  }
}
