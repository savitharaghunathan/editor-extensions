import { LocalChange, GetSolutionResult, RuleSet } from "@editor-extensions/shared";
import { processIncidents } from "./analyzerResults";
import { ExtensionState } from "src/extensionState";
import { writeDataFile } from "./storage";
import { toLocalChanges, writeSolutionsToMemFs } from "./virtualStorage";
import { Location, Position, window } from "vscode";
import {
  KONVEYOR_SCHEME,
  RULE_SET_DATA_FILE_PREFIX,
  SOLUTION_DATA_FILE_PREFIX,
} from "../utilities";

export const loadRuleSets = (state: ExtensionState, ruleSets: RuleSet[]): void => {
  writeDataFile(ruleSets, RULE_SET_DATA_FILE_PREFIX);
  state.ruleSets = ruleSets;
  state.diagnosticCollection.set(processIncidents(ruleSets));
  const sidebarProvider = state.webviewProviders?.get("sidebar");
  sidebarProvider?.webview?.postMessage({
    type: "loadStoredAnalysis",
    data: ruleSets,
  });
};
export const cleanRuleSets = (state: ExtensionState) => {
  state.ruleSets = [];
  state.diagnosticCollection.clear();
  const sidebarProvider = state.webviewProviders?.get("sidebar");
  sidebarProvider?.webview?.postMessage({
    type: "loadStoredAnalysis",
    data: undefined,
  });
};

export const loadSolution = async (state: ExtensionState, solution: GetSolutionResult) => {
  writeDataFile(solution, SOLUTION_DATA_FILE_PREFIX);
  const localChanges = toLocalChanges(solution);
  doLoadSolution(state, localChanges);
  state.localChanges = localChanges;
};

export const reloadLastResolutions = async (state: ExtensionState) => {
  doLoadSolution(state, state.localChanges);
  window.showInformationMessage(`Loaded last available resolutions`);
};

const doLoadSolution = async (state: ExtensionState, localChanges: LocalChange[]) => {
  state.memFs.removeAll(KONVEYOR_SCHEME);
  await writeSolutionsToMemFs(localChanges, state);
  const locations = localChanges.map(
    ({ originalUri: uri }) => new Location(uri, new Position(0, 0)),
  );
  state.fileModel.updateLocations(locations);
};
