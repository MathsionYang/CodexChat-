import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { CodexSessionRepository } from "./codexSessionRepository";
import { CustomProject, SessionIndex } from "./models";
import { resolveLocale } from "./i18n";

const CUSTOM_PROJECTS_KEY = "codexChat.customProjects";

export class SessionService implements vscode.Disposable {
  private readonly locale = resolveLocale(vscode.env.language);
  private readonly changeEmitter = new vscode.EventEmitter<SessionIndex>();
  private readonly disposables: vscode.Disposable[] = [];
  private watchers: vscode.FileSystemWatcher[] = [];
  private refreshTimer: NodeJS.Timeout | undefined;
  private currentRepository: CodexSessionRepository;
  private currentIndex: SessionIndex;
  private refreshPromise: Promise<SessionIndex> | undefined;

  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    const codexHome = this.resolveCodexHome();
    this.currentRepository = new CodexSessionRepository(codexHome, this.locale);
    this.currentIndex = emptyIndex(codexHome);
    this.installWatchers();
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration("codexChat.codexHome")
          || event.affectsConfiguration("codexChat.includeArchivedSessions")) {
          this.currentRepository = new CodexSessionRepository(this.resolveCodexHome(), this.locale);
          this.installWatchers();
          void this.refresh();
        }
      }),
    );
  }

  public get index(): SessionIndex {
    return this.currentIndex;
  }

  public get repository(): CodexSessionRepository {
    return this.currentRepository;
  }

  public async refresh(): Promise<SessionIndex> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.scan();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  public scheduleRefresh(delayMilliseconds = 450): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, delayMilliseconds);
  }

  public async addCustomProject(projectPath: string): Promise<void> {
    const existing = this.getCustomProjects();
    const normalized = path.resolve(projectPath).toLowerCase();
    if (!existing.some(project => path.resolve(project.path).toLowerCase() === normalized)) {
      existing.push({ path: path.resolve(projectPath), addedAt: new Date().toISOString() });
      await this.context.globalState.update(CUSTOM_PROJECTS_KEY, existing);
    }
    await this.refresh();
  }

  public dispose(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.disposeWatchers();
    this.changeEmitter.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async scan(): Promise<SessionIndex> {
    const includeArchived = vscode.workspace
      .getConfiguration("codexChat")
      .get<boolean>("includeArchivedSessions", true);
    this.currentIndex = await this.currentRepository.scan({
      includeArchived,
      customProjects: this.getCustomProjects(),
    });
    this.changeEmitter.fire(this.currentIndex);
    return this.currentIndex;
  }

  private getCustomProjects(): CustomProject[] {
    return this.context.globalState.get<CustomProject[]>(CUSTOM_PROJECTS_KEY, []);
  }

  private resolveCodexHome(): string {
    const configured = vscode.workspace.getConfiguration("codexChat").get<string>("codexHome", "").trim();
    if (configured) {
      return path.resolve(expandHome(configured));
    }
    const environmentHome = process.env.CODEX_HOME?.trim();
    return environmentHome ? path.resolve(expandHome(environmentHome)) : path.join(os.homedir(), ".codex");
  }

  private installWatchers(): void {
    this.disposeWatchers();
    const homeUri = vscode.Uri.file(this.currentRepository.home);
    const patterns = [
      "sessions/**/*.jsonl",
      "archived_sessions/**/*.jsonl",
      "session_index.jsonl",
    ];
    this.watchers = patterns.map(pattern => {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(homeUri, pattern));
      watcher.onDidCreate(() => this.scheduleRefresh());
      watcher.onDidChange(() => this.scheduleRefresh());
      watcher.onDidDelete(() => this.scheduleRefresh());
      return watcher;
    });
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }
}

function expandHome(value: string): string {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith(`~${path.sep}`) || value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function emptyIndex(codexHome: string): SessionIndex {
  return {
    projects: [],
    conversations: [],
    diagnostic: {
      codexHome,
      scannedAt: new Date(0).toISOString(),
      conversationCount: 0,
      projectCount: 0,
      failedFileCount: 0,
      warnings: [],
    },
  };
}
