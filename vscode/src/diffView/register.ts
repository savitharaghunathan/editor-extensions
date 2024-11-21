import * as vscode from "vscode";
import { KonveyorTreeDataProvider } from "./fileModel";
import { Navigation } from "./navigation";
import { ExtensionState } from "src/extensionState";
import { KONVEYOR_READ_ONLY_SCHEME, KONVEYOR_SCHEME } from "../utilities";
import KonveyorReadOnlyProvider from "../data/readOnlyStorage";

export function registerDiffView({
  extensionContext: context,
  memFs,
  fileModel: model,
}: ExtensionState): void {
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(KONVEYOR_SCHEME, memFs, {
      isCaseSensitive: true,
    }),
  );

  const provider = new KonveyorTreeDataProvider(model);
  vscode.window.registerTreeDataProvider("konveyor.diffView", provider);
  const treeView = vscode.window.createTreeView<unknown>("konveyor.diffView", {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  new Navigation(treeView, model);

  treeView.message = model.message;
  context.subscriptions.push(treeView);

  provider.onDidChangeTreeData(() => {
    treeView.message = model.message;
  });

  const readOnlyProvider = new KonveyorReadOnlyProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      KONVEYOR_READ_ONLY_SCHEME,
      readOnlyProvider,
    ),
  );
}
