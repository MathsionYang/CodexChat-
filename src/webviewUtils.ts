import * as vscode from "vscode";

export function nonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return value;
}

export function webviewAssets(webview: vscode.Webview, extensionUri: vscode.Uri): {
  styleUri: vscode.Uri;
  scriptUri: vscode.Uri;
  codiconsUri: vscode.Uri;
} {
  return {
    styleUri: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "webview.css")),
    scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "webview.js")),
    codiconsUri: webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "codicons", "dist", "codicon.css"),
    ),
  };
}

export function csp(webview: vscode.Webview, scriptNonce: string): string {
  return [
    "default-src 'none'",
    `font-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${scriptNonce}'`,
    `img-src ${webview.cspSource} data:`,
  ].join("; ");
}
