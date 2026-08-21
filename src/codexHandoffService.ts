import * as path from "node:path";
import * as vscode from "vscode";
import { PendingHandoff } from "./models";
import { pathsEqual } from "./pathUtils";
import { Locale, localize } from "./i18n";
import { shouldAttemptDirectSessionRestore } from "./codexHandoffPolicy";

const PENDING_HANDOFF_KEY = "codexChat.pendingHandoff";
const PENDING_MAX_AGE_MILLISECONDS = 2 * 60 * 1_000;
const CODEX_EXTENSION_ID = "openai.chatgpt";

export class CodexHandoffService {
  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly locale: Locale,
  ) {}

  public async openProject(projectPath: string, mode: "open" | "new" = "open"): Promise<void> {
    await this.start({ projectPath, mode, createdAt: new Date().toISOString() });
  }

  public async resumeConversation(projectPath: string, sessionId: string): Promise<void> {
    await this.start({ projectPath, sessionId, mode: "resume", createdAt: new Date().toISOString() });
  }

  public async resumePendingHandoff(): Promise<void> {
    const pending = this.context.globalState.get<PendingHandoff>(PENDING_HANDOFF_KEY);
    if (!pending) {
      return;
    }

    const age = Date.now() - Date.parse(pending.createdAt);
    if (!Number.isFinite(age) || age > PENDING_MAX_AGE_MILLISECONDS) {
      await this.clearPending();
      return;
    }

    if (!this.isProjectOpen(pending.projectPath)) {
      return;
    }

    await this.executeInCurrentWorkspace(pending);
  }

  private async start(handoff: PendingHandoff): Promise<void> {
    if (!this.isProjectOpen(handoff.projectPath)) {
      const shouldConfirm = vscode.workspace.getConfiguration("codexChat")
        .get<boolean>("confirmWorkspaceSwitch", true);
      if (shouldConfirm) {
        const choice = await vscode.window.showInformationMessage(
          localize(this.locale, "handoff.confirmOpenWorkspace", { projectPath: handoff.projectPath }),
          { modal: true },
          localize(this.locale, "handoff.confirmOpenWorkspaceButton"),
        );
        if (choice !== localize(this.locale, "handoff.confirmOpenWorkspaceButton")) {
          return;
        }
      }

      await this.context.globalState.update(PENDING_HANDOFF_KEY, handoff);
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(handoff.projectPath), false);
      return;
    }

    await this.executeInCurrentWorkspace(handoff);
  }

  private async executeInCurrentWorkspace(handoff: PendingHandoff): Promise<void> {
    const codex = vscode.extensions.getExtension(CODEX_EXTENSION_ID);
    if (!codex) {
      await this.clearPending();
      const choice = await vscode.window.showErrorMessage(
        localize(this.locale, "handoff.missingExtension"),
        localize(this.locale, "handoff.openMarketplace"),
      );
      if (choice === localize(this.locale, "handoff.openMarketplace")) {
        await vscode.commands.executeCommand("extension.open", CODEX_EXTENSION_ID);
      }
      return;
    }

    try {
      if (!codex.isActive) {
        await codex.activate();
      }

      const commands = await vscode.commands.getCommands(true);
      if (!commands.includes("chatgpt.openSidebar")) {
        throw new Error(localize(this.locale, "handoff.missingOpenSidebar"));
      }

      await vscode.commands.executeCommand("chatgpt.openSidebar");
      if (handoff.mode === "new") {
        const command = commands.includes("chatgpt.newCodexPanel")
          ? "chatgpt.newCodexPanel"
          : commands.includes("chatgpt.newChat") ? "chatgpt.newChat" : undefined;
        if (command) {
          await vscode.commands.executeCommand(command);
        }
      } else if (handoff.mode === "resume" && handoff.sessionId) {
        await this.tryOpenConversation(codex.packageJSON.version, handoff.sessionId);
      }
    } catch (error) {
      void vscode.window.showErrorMessage(localize(this.locale, "handoff.enterCodexError", {
        message: toErrorMessage(error),
      }));
    } finally {
      await this.clearPending();
    }
  }

  private async tryOpenConversation(version: unknown, sessionId: string): Promise<void> {
    const enabled = vscode.workspace.getConfiguration("codexChat")
      .get<boolean>("enableExperimentalSessionHandoff", true);
    if (!shouldAttemptDirectSessionRestore(enabled, version)) {
      await vscode.env.clipboard.writeText(sessionId);
      void vscode.window.showWarningMessage(
        localize(this.locale, "handoff.sessionRestoreDisabled"),
      );
      return;
    }

    const route = vscode.Uri.parse(`vscode://${CODEX_EXTENSION_ID}/local/${encodeURIComponent(sessionId)}`);
    const opened = await vscode.env.openExternal(route);
    if (!opened) {
      await vscode.env.clipboard.writeText(sessionId);
      void vscode.window.showWarningMessage(localize(this.locale, "handoff.directRestoreFailed"));
    }
  }

  private isProjectOpen(projectPath: string): boolean {
    const folders = vscode.workspace.workspaceFolders ?? [];
    return folders.some(folder => pathsEqual(folder.uri.fsPath, projectPath));
  }

  private async clearPending(): Promise<void> {
    await this.context.globalState.update(PENDING_HANDOFF_KEY, undefined);
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
