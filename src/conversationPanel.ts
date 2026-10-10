import * as vscode from "vscode";
import { ConversationDetail } from "./models";
import { CodexHandoffService } from "./codexHandoffService";
import { SessionService } from "./sessionService";
import { Locale, formatDate, localize, webviewContext } from "./i18n";
import { csp, nonce, webviewAssets } from "./webviewUtils";

export class ConversationPanel {
  private static current: ConversationPanel | undefined;

  public static show(
    context: vscode.ExtensionContext,
    detail: ConversationDetail,
    handoff: CodexHandoffService,
    sessions: SessionService,
    locale: Locale,
  ): void {
    if (ConversationPanel.current) {
      ConversationPanel.current.panel.reveal(vscode.ViewColumn.One);
      ConversationPanel.current.update(detail);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "codexChat.conversation",
      detail.summary.title,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      },
    );
    ConversationPanel.current = new ConversationPanel(context, panel, detail, handoff, sessions, locale);
  }

  private readonly disposables: vscode.Disposable[] = [];
  private detail: ConversationDetail;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panel: vscode.WebviewPanel,
    detail: ConversationDetail,
    private readonly handoff: CodexHandoffService,
    private readonly sessions: SessionService,
    private readonly locale: Locale,
  ) {
    this.detail = detail;
    this.render();
    this.disposables.push(
      panel.onDidDispose(() => this.dispose()),
      panel.webview.onDidReceiveMessage(message => this.onMessage(message)),
      sessions.onDidChange(index => {
        if (!index.conversations.some(item => item.id === this.detail.summary.id)) this.panel.dispose();
      }),
    );
  }

  private update(detail: ConversationDetail): void {
    this.detail = detail;
    this.render();
  }

  private render(): void {
    this.panel.title = this.detail.summary.title;
    const webview = this.panel.webview;
    const assets = webviewAssets(webview, this.context.extensionUri);
    const scriptNonce = nonce();
    const data = webviewContext(this.locale, "detail", { detail: this.detail });
    webview.html = `<!doctype html>
<html lang="${this.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp(webview, scriptNonce)}">
  <link rel="stylesheet" href="${assets.codiconsUri}">
  <link rel="stylesheet" href="${assets.styleUri}">
  <title>${escapeHtml(this.detail.summary.title)}</title>
</head>
<body data-view="detail">
  <main id="app"></main>
  <script nonce="${scriptNonce}">window.__CODEX_CHAT_CONTEXT__=${data};</script>
  <script nonce="${scriptNonce}" src="${assets.scriptUri}"></script>
</body>
</html>`;
  }

  private async onMessage(message: unknown): Promise<void> {
    if (!isMessage(message)) {
      return;
    }
    const summary = this.detail.summary;
    switch (message.type) {
      case "resumeConversation":
        await this.handoff.resumeConversation(summary.projectPath, summary.id, summary.git?.branch);
        break;
      case "copySessionId":
        await vscode.env.clipboard.writeText(summary.id);
        void vscode.window.showInformationMessage(localize(this.locale, "conversation.copiedId"));
        break;
      case "revealSessionFile":
        await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(summary.filePath));
        break;
      case "deleteConversation": {
        const confirmLabel = localize(this.locale, "delete.confirmConversationButton");
        const choice = await vscode.window.showWarningMessage(
          localize(this.locale, "delete.confirmConversation", { title: summary.title }),
          { modal: true },
          confirmLabel,
        );
        if (choice === confirmLabel) {
          try {
            await this.sessions.deleteConversation(summary);
          } catch (error) {
            void vscode.window.showErrorMessage(localize(this.locale, "sidebar.actionError", {
              message: error instanceof Error ? error.message : String(error),
            }));
          }
        }
        break;
      }
      case "openProjectFolder":
        await vscode.env.openExternal(vscode.Uri.file(summary.projectPath));
        break;
    }
  }

  private dispose(): void {
    ConversationPanel.current = undefined;
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function isMessage(value: unknown): value is { type: string } {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}
