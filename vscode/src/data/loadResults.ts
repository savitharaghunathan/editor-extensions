import { GetSolutionResult, RuleSet } from "@shared/types";
import { processIncidents } from "./analyzerResults";
import { ExtensionState } from "src/extensionState";
import { writeDataFile } from "./storage";

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

export const loadSolution = (state: ExtensionState, solution: GetSolutionResult): void => {
  writeDataFile(solution, "solution");
  state.extensionContext.workspaceState.update("storedSolution", solution);
};
