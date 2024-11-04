import * as vscode from "vscode";
import fs from "fs/promises";
import { RuleSet } from "@shared/types";
import { isAnalysis, isSolution } from "./typeGuards";

export const loadStaticResults = async () => {
  const options: vscode.OpenDialogOptions = {
    defaultUri: vscode.workspace.workspaceFolders?.[0].uri,
    openLabel: "Load Konveyor results",
    filters: { "json files": ["json"] },
    canSelectMany: true,
  };
  const uris = await vscode.window.showOpenDialog(options);

  if (!uris?.length) {
    vscode.window.showErrorMessage("No files selected");
    return;
  }

  let analysisResults = undefined;
  let solution = undefined;
  for (const uri of uris) {
    if (!uri || (analysisResults && solution)) {
      break;
    }
    const fileContent = await fs.readFile(uri.fsPath, { encoding: "utf8" });
    const parsed = JSON.parse(fileContent);
    solution = !solution && isSolution(parsed) ? parsed : solution;
    analysisResults =
      !analysisResults && Array.isArray(parsed) && parsed.every((item) => isAnalysis(item))
        ? parsed
        : analysisResults;
  }

  if (!analysisResults && !solution) {
    vscode.window.showErrorMessage("Konveyor: failed to load data from selected file(s).");
    return;
  }

  if (analysisResults) {
    if (filePathsCorrect(analysisResults)) {
      vscode.commands.executeCommand("konveyor.loadRuleSets", analysisResults);
      vscode.window.showInformationMessage("Successfully loaded the analysis results");
    } else {
      vscode.window.showErrorMessage("Konveyor: analysis results point to non-existing files.");
    }
  }
  if (solution) {
    // TODO: implement
    vscode.window.showInformationMessage("Successfully loaded the solutions");
  }
};

//TODO: as for now analysis results are based on absolute paths which
const filePathsCorrect = (ruleSets: RuleSet[]) =>
  ruleSets
    .flatMap((ruleSet) => Object.values(ruleSet.violations ?? {}))
    .flatMap((violation) => violation.incidents)
    .every(
      (incident) =>
        !incident.uri || vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(incident.uri)),
    );
