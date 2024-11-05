import path from "path";
import * as vscode from "vscode";
import fs from "fs";
import { RuleSet, GetSolutionResult } from "@shared/types";

const MAX_FILES = 5;

const buildDataFolderPath = () => {
  const firstWorkspace = vscode.workspace.workspaceFolders?.[0];
  if (!firstWorkspace) {
    return;
  }

  return path.join(firstWorkspace.uri.fsPath, ".vscode", "konveyor");
};

const getDataFolder = () => {
  const dataFolderPath = buildDataFolderPath();
  return dataFolderPath && fs.existsSync(dataFolderPath) ? dataFolderPath : undefined;
};

const createDataFolderIfNeeded = async () => {
  if (getDataFolder()) {
    return;
  }
  const dataFolderPath = buildDataFolderPath();
  if (dataFolderPath) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(dataFolderPath));
  } else {
    console.log("Cannot create data folder due to no workspace");
  }
};

const getDataFilesByPrefix = async (prefix: string) => {
  const dataFolderPath = getDataFolder();
  if (!dataFolderPath) {
    return [];
  }
  const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dataFolderPath));
  return files
    .filter(([name]) => name.startsWith(prefix))
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
};

const deleteOldestDataFiles = async (prefix: string, maxCount: number) => {
  const files = await getDataFilesByPrefix(prefix);

  const dataFolderPath = getDataFolder();
  if (!dataFolderPath) {
    return;
  }

  const delCount = files.length - maxCount;
  for (let i = 0; i < delCount; i++) {
    const [name] = files[i];
    await vscode.workspace.fs.delete(vscode.Uri.file(path.join(dataFolderPath, name)));
  }
};

export async function writeDataFile(
  content: RuleSet[] | GetSolutionResult,
  prefix: string,
  format: "json" = "json",
) {
  await createDataFolderIfNeeded();

  const dataFolderPath = getDataFolder();
  if (!dataFolderPath) {
    return;
  }

  const dateString = new Date()
    .toISOString()
    .replaceAll(":", "")
    .replaceAll("-", "")
    .substring(0, 15);
  // i.e .vscode/konveyor/analysis_20241105T124657.json
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(path.join(dataFolderPath, `${prefix}_${dateString}.${format}`)),
    Buffer.from(JSON.stringify(content, undefined, 2)),
  );

  deleteOldestDataFiles(prefix, MAX_FILES);
}
