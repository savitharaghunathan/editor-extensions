import * as vscode from "vscode";
import { FileItem, KonveyorFileModel } from "./fileModel";

export async function copyDiff(item: KonveyorFileModel | FileItem | unknown) {
  let val: string | undefined;
  if (item instanceof FileItem) {
    val = await item.asCopyText();
  }
  if (val) {
    await vscode.env.clipboard.writeText(val);
  }
}

export async function copyPath(item: FileItem | unknown) {
  if (item instanceof FileItem) {
    if (item.uri.scheme === "file") {
      vscode.env.clipboard.writeText(item.uri.fsPath);
    } else {
      vscode.env.clipboard.writeText(item.uri.toString(true));
    }
  }
}
