import * as vscode from "vscode";
import { ExtensionState } from "src/extensionState";
import { fromRelativeToKonveyor } from "../utilities";

export const applyAll = async (state: ExtensionState) => {
  console.log(state.fileModel.message);
  vscode.window.showInformationMessage(`[TODO] Apply all resolutions`);
};

export const revertAll = async (state: ExtensionState) => {
  console.log(state.fileModel.message);
  vscode.window.showInformationMessage(`[TODO] Revert all resolutions`);
};

export const viewFix = (uri: vscode.Uri, preserveFocus: boolean = false) =>
  vscode.commands.executeCommand(
    "vscode.diff",
    uri,
    fromRelativeToKonveyor(vscode.workspace.asRelativePath(uri)),
    "Current file <-> Suggested changes",
    {
      preserveFocus,
    },
  );
