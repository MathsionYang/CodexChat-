import * as path from "node:path";
import * as vscode from "vscode";
import { CodexHandoffService } from "./codexHandoffService";
import { ConversationPanel } from "./conversationPanel";
import { ConversationSummary, ProjectSummary, SessionIndex } from "./models";
import { SessionService } from "./sessionService";
import { csp, nonce, webviewAssets } from "./webviewUtils";

const SELECTED_PROJECT_KEY = "codexChat.selectedProjectPath";

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = "codexChat.sidebar";

  private view: vscode.WebviewView | undefined;
  private selectedProjectPath: string | undefined;
  private loading = true;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly sessions: SessionService,
    private readonly handoff: CodexHandoffService,
  ) {
    this.selectedProjectPath = context.globalState.get<string>(SELECTED_PROJECT_KEY);
    this.disposables.push(
      sessions.onDidChange(index => {
        this.loading = false;
        this.reconcileSelectedProject(index);
        void this.postState();
      }),
    );
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    webviewView.webview.html = this.html(webviewView.webview);
    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(message => this.onMessage(message)),
      webviewView.onDidDispose(() => {
        this.view = undefined;
      }),
    );
    void this.postState();
  }

  public async selectProjectFolder(): Promise<void> {
    const folders = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "选择项目",
      title: "选择 CodexChat 项目文件夹",
    });
    const folder = folders?.[0];
    if (!folder) {
      return;
    }
    await this.sessions.addCustomProject(folder.fsPath);
    await this.setSelectedProject(folder.fsPath);
  }

  public async openSelectedProjectInCodex(mode: "open" | "new" = "open"): Promise<void> {
    const project = this.getSelectedProject();
    if (!project?.path) {
      void vscode.window.showInformationMessage("请先在 CodexChat 中选择项目。");
      return;
    }
    await this.handoff.openProject(project.path, mode);
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async onMessage(message: unknown): Promise<void> {
    if (!isMessage(message)) {
      return;
    }
    switch (message.type) {
      case "ready":
        await this.postState();
        break;
      case "refresh":
        this.loading = true;
        await this.postState();
        await this.sessions.refresh();
        break;
      case "chooseFolder":
        await this.selectProjectFolder();
        break;
      case "selectProject":
        if (typeof message.projectPath === "string") {
          await this.setSelectedProject(message.projectPath);
        }
        break;
      case "showProjects":
        await this.setSelectedProject(undefined);
        break;
      case "openConversation":
        if (typeof message.sessionId === "string") {
          await this.openConversation(message.sessionId);
        }
        break;
      case "openCodex":
        await this.openSelectedProjectInCodex(message.mode === "new" ? "new" : "open");
        break;
      case "resumeConversation":
        if (typeof message.sessionId === "string") {
          await this.resumeConversation(message.sessionId);
        }
        break;
      case "openSettings":
        await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:local.codexchat");
        break;
      case "showDiagnostic":
        await this.showDiagnostic();
        break;
    }
  }

  private async openConversation(sessionId: string): Promise<void> {
    const summary = this.findConversation(sessionId);
    if (!summary) {
      void vscode.window.showWarningMessage("该会话已不存在，请刷新后重试。");
      return;
    }
    try {
      const detail = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: "正在读取 Codex 会话..." },
        () => this.sessions.repository.readConversation(summary),
      );
      ConversationPanel.show(this.context, detail, this.handoff);
    } catch (error) {
      void vscode.window.showErrorMessage(`无法读取会话：${toErrorMessage(error)}`);
    }
  }

  private async resumeConversation(sessionId: string): Promise<void> {
    const summary = this.findConversation(sessionId);
    if (!summary) {
      return;
    }
    if (!summary.projectPath) {
      void vscode.window.showWarningMessage("该会话没有项目路径，无法在 Codex 中恢复。");
      return;
    }
    await this.handoff.resumeConversation(summary.projectPath, summary.id);
  }

  private findConversation(sessionId: string): ConversationSummary | undefined {
    return this.sessions.index.conversations.find(conversation => conversation.id === sessionId);
  }

  private getSelectedProject(): ProjectSummary | undefined {
    const selectedProjectPath = this.selectedProjectPath;
    if (!selectedProjectPath) {
      return undefined;
    }
    return this.sessions.index.projects.find(project => samePath(project.path, selectedProjectPath));
  }

  private async setSelectedProject(projectPath: string | undefined): Promise<void> {
    this.selectedProjectPath = projectPath;
    await this.context.globalState.update(SELECTED_PROJECT_KEY, projectPath);
    await this.postState();
  }

  private reconcileSelectedProject(index: SessionIndex): void {
    if (!this.selectedProjectPath) {
      return;
    }
    if (!index.projects.some(project => samePath(project.path, this.selectedProjectPath ?? ""))) {
      this.selectedProjectPath = undefined;
      void this.context.globalState.update(SELECTED_PROJECT_KEY, undefined);
    }
  }

  private async postState(): Promise<void> {
    if (!this.view) {
      return;
    }
    await this.view.webview.postMessage({
      type: "state",
      payload: {
        loading: this.loading,
        index: this.sessions.index,
        selectedProjectPath: this.selectedProjectPath,
      },
    });
  }

  private async showDiagnostic(): Promise<void> {
    const diagnostic = this.sessions.index.diagnostic;
    const lines = [
      `Codex 目录：${diagnostic.codexHome}`,
      `项目：${diagnostic.projectCount}`,
      `会话：${diagnostic.conversationCount}`,
      `解析失败：${diagnostic.failedFileCount}`,
      `扫描时间：${formatDate(diagnostic.scannedAt)}`,
      ...diagnostic.warnings.map(warning => `警告：${warning}`),
    ];
    const document = await vscode.workspace.openTextDocument({
      language: "text",
      content: lines.join("\n"),
    });
    await vscode.window.showTextDocument(document, { preview: true });
  }

  private html(webview: vscode.Webview): string {
    const assets = webviewAssets(webview, this.context.extensionUri);
    const scriptNonce = nonce();
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp(webview, scriptNonce)}">
  <link rel="stylesheet" href="${assets.codiconsUri}">
  <link rel="stylesheet" href="${assets.styleUri}">
  <title>CodexChat</title>
</head>
<body data-view="sidebar">
  <main id="app"><div class="loading"><span class="codicon codicon-loading codicon-modifier-spin"></span>正在扫描本地会话...</div></main>
  <script nonce="${scriptNonce}" src="${assets.scriptUri}"></script>
</body>
</html>`;
  }
}

function samePath(first: string, second: string): boolean {
  const normalize = (value: string) => path.normalize(path.resolve(value)).toLowerCase();
  return Boolean(first) && Boolean(second) && normalize(first) === normalize(second);
}

function isMessage(value: unknown): value is { type: string; [key: string]: unknown } {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN");
}
