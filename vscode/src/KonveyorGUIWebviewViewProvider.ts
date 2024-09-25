import * as vscode from "vscode";
import { getNonce } from "./getNonce";

export class KonveyorGUIWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "konveyor.konveyorGUIView";
  private _webview?: vscode.Webview;
  private _webviewView?: vscode.WebviewView;
  private outputChannel: vscode.OutputChannel;
  private webviewReadyCallback?: (webview: vscode.Webview) => void;

  constructor(
    private readonly windowId: string,
    private readonly extensionContext: vscode.ExtensionContext,
  ) {
    this.outputChannel = vscode.window.createOutputChannel("Konveyor");
  }

  get isVisible() {
    return this._webviewView?.visible;
  }

  get webview() {
    return this._webview;
  }
  onWebviewReady(callback: (webview: vscode.Webview) => void) {
    this.webviewReadyCallback = callback;
    if (this._webview) {
      callback(this._webview);
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._webview = webviewView.webview;
    this._webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionContext.extensionUri, "media"),
        vscode.Uri.joinPath(this.extensionContext.extensionUri, "out"),
      ],
    };

    webviewView.webview.html = this.getSidebarContent(
      this.extensionContext,
      webviewView,
      true,
    );

    if (this.webviewReadyCallback) {
      this.webviewReadyCallback(webviewView.webview);
    }
  }

  getSidebarContent(
    context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel | vscode.WebviewView,
    isFullScreen: boolean = false,
  ): string {
    const webview = panel.webview;
    const extensionUri = context.extensionUri;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "out", "webview", "main.wv.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "media", "styles.css"),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
          webview.cspSource
        }; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-inline';">
        <title>Konveyor</title>
        <link rel="stylesheet" href="${styleUri}">
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          window.addEventListener('load', function() {
            vscode.postMessage({ command: 'startup', isFullScreen: ${isFullScreen} });
            console.log('HTML started up. Full screen:', ${isFullScreen});
          });
        </script>
        ${`<script nonce="${nonce}" src="${scriptUri}"></script>`}
      </body>
    </html>
    `;
  }
}
