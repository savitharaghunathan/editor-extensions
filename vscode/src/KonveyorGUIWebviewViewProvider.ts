import * as vscode from 'vscode';

export class KonveyorGUIWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "konveyor.konveyorGUIView";
  // public webviewProtocol: VsCodeWebviewProtocol;

  private _webview?: vscode.Webview;
  private _webviewView?: vscode.WebviewView;
  private outputChannel: vscode.OutputChannel;
  // private enableDebugLogs: boolean;

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

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._webview = webviewView.webview;
    // this._webview.onDidReceiveMessage((message) =>
    //   this.handleWebviewMessage(message),
    // );
    webviewView.webview.html = this.getSidebarContent(
      this.extensionContext,
      webviewView,
    );
  }

  getSidebarContent(
    context: vscode.ExtensionContext | undefined,
    panel: vscode.WebviewPanel | vscode.WebviewView,
    // page: string | undefined = undefined,
    // edits: FileEdit[] | undefined = undefined,
    isFullScreen = false,
  ): string {
    const extensionUri = vscode.extensions.getExtension("Konveyor.konveyor")!.extensionUri;

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Konveyor</title>
      </head>
      <body>
        <h1>Konveyor</h1>
      </body>
    </html>
    `;
  }
}