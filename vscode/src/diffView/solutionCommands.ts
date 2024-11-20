import * as vscode from "vscode";
import { ExtensionState } from "src/extensionState";
import { fromRelativeToKonveyor } from "../utilities";
import { FileItem, toUri } from "./fileModel";

export const applyAll = async (state: ExtensionState) => {
  const localChanges = state.localChanges;
  await Promise.all(
    localChanges.map(({ originalUri, modifiedUri }) =>
      vscode.workspace.fs.copy(modifiedUri, originalUri, { overwrite: true }),
    ),
  );
  const sidebarProvider = state.webviewProviders?.get("sidebar");
  sidebarProvider?.webview?.postMessage({
    type: "solutionConfirmation",
    data: { confirmed: true, solution: null },
  });
  //TODO: need to keep solutions view and analysis view in sync based on these actions
  vscode.window.showInformationMessage(`All resolutions applied successfully`);
  state.fileModel.updateLocations([]);
};

export const discardAll = async (state: ExtensionState) => {
  const localChanges = state.localChanges;
  await Promise.all(
    localChanges.map(({ originalUri, modifiedUri }) =>
      vscode.workspace.fs.copy(originalUri, modifiedUri, { overwrite: true }),
    ),
  );
  state.fileModel.updateLocations([]);
  vscode.window.showInformationMessage(`Discarded all resolutions`);
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

export const applyFile = async (item: FileItem | vscode.Uri | unknown, state: ExtensionState) => {
  const originalUri = toUri(item);
  if (!originalUri) {
    vscode.window.showErrorMessage("Failed to apply changes");
    console.error("Failed to apply changes", item, originalUri);
    return;
  }
  const modifiedUri = fromRelativeToKonveyor(vscode.workspace.asRelativePath(originalUri));
  await vscode.workspace.fs.copy(modifiedUri, originalUri, { overwrite: true });
  state.fileModel.markedAsApplied(originalUri);
};

interface ApplyBlockArgs {
  mapping: { original: vscode.Range; innerChanges: unknown };
  modifiedUri: vscode.Uri;
  originalUri: vscode.Uri;
  originalWithModifiedChanges: string;
}

export const applyBlock = async ({ originalUri, originalWithModifiedChanges }: ApplyBlockArgs) => {
  const doc = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === originalUri.toString(),
  );

  if (!doc) {
    vscode.window.showErrorMessage(`Failed to retrieve editor for ${originalUri}`);
    console.error(`Failed to retrieve editor for ${originalUri}`);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  edit.replace(originalUri, new vscode.Range(0, 0, doc.lineCount, 0), originalWithModifiedChanges);

  // note that left side edits will open a duplicated editor
  // bug opened: https://github.com/microsoft/vscode/issues/234097
  return vscode.workspace.applyEdit(edit);
};

export const discardFile = async (item: FileItem | vscode.Uri | unknown, state: ExtensionState) => {
  const originalUri = toUri(item);
  if (!originalUri) {
    vscode.window.showErrorMessage("Failed to discard changes");
    console.error("Failed to discard changes", item, originalUri);
    return;
  }
  const modifiedUri = fromRelativeToKonveyor(vscode.workspace.asRelativePath(originalUri));
  await vscode.workspace.fs.copy(originalUri, modifiedUri, { overwrite: true });
  state.fileModel.markedAsApplied(originalUri);
};
