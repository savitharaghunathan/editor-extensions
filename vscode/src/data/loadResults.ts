import { RuleSet } from "@shared/types";
import { processIncidents } from "./analyzerResults";
import { ExtensionState } from "src/extensionState";

export const loadRuleSets = (state: ExtensionState, ruleSets: RuleSet[]): void => {
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
