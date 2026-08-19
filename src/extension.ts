import * as vscode from "vscode";
import { CodexHandoffService } from "./codexHandoffService";
import { SessionService } from "./sessionService";
import { SidebarProvider } from "./sidebarProvider";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const sessions = new SessionService(context);
  const handoff = new CodexHandoffService(context);
  const sidebar = new SidebarProvider(context, sessions, handoff);

  context.subscriptions.push(
    sessions,
    sidebar,
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("codexChat.refresh", () => sessions.refresh()),
    vscode.commands.registerCommand("codexChat.selectProject", () => sidebar.selectProjectFolder()),
    vscode.commands.registerCommand("codexChat.openCodex", () => sidebar.openSelectedProjectInCodex()),
    vscode.commands.registerCommand("codexChat.openSettings", () => (
      vscode.commands.executeCommand("workbench.action.openSettings", "@ext:local.codexchat")
    )),
  );

  void sessions.refresh();
  await handoff.resumePendingHandoff();
}

export function deactivate(): void {}
