import { GetSolutionResult, RuleSet } from "@shared/types";
import { processIncidents } from "./analyzerResults";
import { ExtensionState } from "src/extensionState";
import { writeDataFile } from "./storage";
import { writeSolutionsToMemFs } from "./virtualStorage";
import { Location, Position } from "vscode";

export const loadRuleSets = (state: ExtensionState, ruleSets: RuleSet[]): void => {
  writeDataFile(ruleSets, "analysis");
  state.extensionContext.workspaceState.update("storedRuleSets", ruleSets);
  state.diagnosticCollection.set(processIncidents(ruleSets));
  state.sidebarProvider?.webview?.postMessage({
    type: "loadStoredAnalysis",
    data: ruleSets,
  });
};
export const cleanRuleSets = (state: ExtensionState) => {
  state.extensionContext.workspaceState.update("storedRuleSets", undefined);
  state.diagnosticCollection.clear();
  state.sidebarProvider?.webview?.postMessage({
    type: "loadStoredAnalysis",
    data: undefined,
  });
};

export const loadSolution = async (state: ExtensionState, solution: GetSolutionResult) => {
  writeDataFile(solution, "solution");
  state.extensionContext.workspaceState.update("storedSolution", solution);
  const localChanges = await writeSolutionsToMemFs(solution, state);
  const locations = localChanges.map(
    ({ originalUri: uri }) => new Location(uri, new Position(0, 0)),
  );
  state.fileModel.updateLocations(locations);
};
