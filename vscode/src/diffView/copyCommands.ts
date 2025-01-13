import * as vscode from "vscode";
import { FileItem, toUri } from "./fileModel";
import { ExtensionState } from "src/extensionState";

export async function copyDiff(item: FileItem | vscode.Uri | unknown, state: ExtensionState) {
  const localChanges = state.data.localChanges;
  const uri = toUri(item);
  if (!uri) {
    console.error("Failed to copy diff. Unknown URI.", item, uri);
    return;
  }
  const change = localChanges.find((change) => change.originalUri.toString() === uri.toString());
  if (change) {
    vscode.env.clipboard.writeText(change.diff);
  } else {
    console.error("Failed to copy diff. Unknown change.", item, uri);
  }
}

export async function copyPath(item: FileItem | vscode.Uri | unknown) {
  const uri = toUri(item);
  if (uri?.scheme === "file") {
    vscode.env.clipboard.writeText(uri.fsPath);
  } else if (uri) {
    vscode.env.clipboard.writeText(uri.toString(true));
  }
}
