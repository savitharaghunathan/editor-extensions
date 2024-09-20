import * as vscode from "vscode";
import { v4 as uuidv4 } from "uuid";
import { KonveyorGUIWebviewViewProvider } from "./KonveyorGUIWebviewViewProvider";
import { registerAllCommands } from "./commands";

export class VsCodeExtension {
  private extensionContext: vscode.ExtensionContext;
  private sidebar: KonveyorGUIWebviewViewProvider;
  private windowId: string;

  constructor(context: vscode.ExtensionContext) {
    this.extensionContext = context;
    this.windowId = uuidv4();
    this.sidebar = new KonveyorGUIWebviewViewProvider(
      this.windowId,
      this.extensionContext
    );

    // Sidebar
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "konveyor.konveyorGUIView",
        this.sidebar,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
        }
      )
    );
    // this.sidebar.webview.onDidReceiveMessage(async (message: any) => {
    //   switch (message.command) {
    //     case "startup":
    //       console.log("received message from webview");
    //       break;
    //     case "testing":
    //       console.log("received message from webview");
    //       this.sidebar!.webview.postMessage({ command: "refactor" });
    //       break;
    //   }
    // });

    // Commands
    registerAllCommands(context, this.extensionContext, this.sidebar);
  }
}
