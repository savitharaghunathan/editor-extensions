import * as vscode from "vscode";

export function setupWebviewMessageListener(webview: vscode.Webview) {
  return webview.onDidReceiveMessage(async (message: any) => {
    switch (message.command) {
      case "startup":
        console.log("received startup message from webview");
        break;
      case "testing":
        console.log("received testing message from webview");
        webview.postMessage({ command: "refactor" });
        break;
      // Add more cases as needed
    }
  });
}
