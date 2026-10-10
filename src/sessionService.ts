import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { CodexSessionRepository, SessionFileReference } from "./codexSessionRepository";
import { ConversationSummary, CustomProject, ProjectSummary, SessionIndex } from "./models";
import { resolveLocale } from "./i18n";
import { normalizeProjectPath, pathsEqual } from "./pathUtils";

const CUSTOM_PROJECTS_KEY = "codexChat.customProjects";
const PINNED_PROJECTS_KEY = "codexChat.pinnedProjects";
const PINNED_CONVERSATIONS_KEY = "codexChat.pinnedConversations";

export class SessionService implements vscode.Disposable {
  private readonly locale = resolveLocale(vscode.env.language);
  private readonly changeEmitter = new vscode.EventEmitter<SessionIndex>();
  private readonly disposables: vscode.Disposable[] = [];
  private watchers: vscode.FileSystemWatcher[] = [];
  private refreshTimer: NodeJS.Timeout | undefined;
  private currentRepository: CodexSessionRepository;
  private currentIndex: SessionIndex;
  private refreshPromise: Promise<SessionIndex> | undefined;
  private mutationQueue: Promise<void> = Promise.resolve();
  private readonly deletedIds = new Map<string, Set<string>>();
  private readonly fileRevisions = new Map<string, number>();
  private pinnedProjectPaths: string[];
  private pinnedConversationIds: string[];

  public readonly onDidChange = this.changeEmitter.event;

  public constructor(private readonly context: vscode.ExtensionContext) {
    const codexHome = this.resolveCodexHome();
    this.currentRepository = new CodexSessionRepository(codexHome, this.locale);
    this.currentIndex = emptyIndex(codexHome);
    this.pinnedProjectPaths = [...context.globalState.get<string[]>(PINNED_PROJECTS_KEY, [])];
    this.pinnedConversationIds = [...context.globalState.get<string[]>(PINNED_CONVERSATIONS_KEY, [])];
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

  public async toggleProjectPin(projectPath: string): Promise<void> {
    return this.mutate(async () => {
      if (!this.currentIndex.projects.some(project => pathsEqual(project.path, projectPath))) return;
      const current = this.getPinnedProjects();
      const next = current.filter(item => !pathsEqual(item, projectPath));
      if (next.length === current.length) next.push(path.resolve(projectPath));
      await this.savePins(PINNED_PROJECTS_KEY, next);
      this.publish(this.currentIndex);
    });
  }

  public async toggleConversationPin(sessionId: string): Promise<void> {
    return this.mutate(async () => {
      if (!this.currentIndex.conversations.some(item => item.id === sessionId)) return;
      const current = this.getPinnedConversations();
      const next = current.includes(sessionId)
        ? current.filter(item => item !== sessionId)
        : [...current, sessionId];
      await this.savePins(PINNED_CONVERSATIONS_KEY, next);
      this.publish(this.currentIndex);
    });
  }

  public async deleteConversation(summary: ConversationSummary): Promise<void> {
    const repository = this.currentRepository;
    return this.mutate(async () => {
      try {
        await repository.deleteConversation(summary, (_id, complete) => {
          this.invalidateFileScans(repository);
          if (complete) this.rememberDeleted(repository, [summary.id]);
        });
      } catch (error) {
        await this.reconcileFailedDeletion(repository);
        throw error;
      }
      this.rememberDeleted(repository, [summary.id]);
      this.invalidateFileScans(repository);
      if (pathsEqual(repository.home, this.currentRepository.home)) this.publish(this.currentIndex);
      await this.savePins(
        PINNED_CONVERSATIONS_KEY,
        this.getPinnedConversations().filter(sessionId => sessionId !== summary.id),
      );
    });
  }

  public async deleteProject(project: ProjectSummary, files?: SessionFileReference[]): Promise<void> {
    const repository = this.currentRepository;
    return this.mutate(async () => {
      const targets = files ?? await repository.listProjectSessionFiles(project.path);
      try {
        await repository.deleteProject(project.path, targets, (id, complete) => {
          this.invalidateFileScans(repository);
          if (complete) this.rememberDeleted(repository, [id]);
        });
      } catch (error) {
        await this.reconcileFailedDeletion(repository);
        throw error;
      }
      try {
        await this.context.globalState.update(
          CUSTOM_PROJECTS_KEY,
          this.getCustomProjects().filter(item => !pathsEqual(item.path, project.path)),
        );
        await this.savePins(
          PINNED_PROJECTS_KEY,
          this.getPinnedProjects().filter(item => !pathsEqual(item, project.path)),
        );
        const ids = new Set(targets.map(file => file.id));
        await this.savePins(
          PINNED_CONVERSATIONS_KEY,
          this.getPinnedConversations().filter(id => !ids.has(id)),
        );
      } finally {
        if (pathsEqual(repository.home, this.currentRepository.home)) this.publish(this.currentIndex);
      }
    });
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
    const repository = this.currentRepository;
    const revision = this.fileRevisions.get(normalizeProjectPath(repository.home)) ?? 0;
    const index = await repository.scan({
      includeArchived,
      customProjects: this.getCustomProjects(),
      pinnedProjectPaths: this.getPinnedProjects(),
      pinnedConversationIds: this.getPinnedConversations(),
    });
    if (repository === this.currentRepository
      && revision === (this.fileRevisions.get(normalizeProjectPath(repository.home)) ?? 0)) {
      this.publish(index);
    } else {
      this.scheduleRefresh(0);
    }
    return this.currentIndex;
  }

  private mutate(action: () => Promise<void>): Promise<void> {
    const result = this.mutationQueue.then(action);
    this.mutationQueue = result.catch(() => undefined);
    return result;
  }

  private rememberDeleted(repository: CodexSessionRepository, ids: string[]): void {
    const source = normalizeProjectPath(repository.home);
    const deleted = this.deletedIds.get(source) ?? new Set<string>();
    ids.forEach(id => deleted.add(id));
    this.deletedIds.set(source, deleted);
  }

  private invalidateFileScans(repository: CodexSessionRepository): void {
    const source = normalizeProjectPath(repository.home);
    this.fileRevisions.set(source, (this.fileRevisions.get(source) ?? 0) + 1);
  }

  private async reconcileFailedDeletion(repository: CodexSessionRepository): Promise<void> {
    this.invalidateFileScans(repository);
    if (!pathsEqual(repository.home, this.currentRepository.home)) return;
    this.publish(this.currentIndex);
    // A duplicate may survive after the indexed file was removed. Resolve its actual path.
    try {
      await this.scan();
    } catch {
      this.scheduleRefresh();
    }
  }

  private publish(index: SessionIndex): void {
    const deleted = this.deletedIds.get(normalizeProjectPath(this.currentRepository.home));
    const pins = new Set(this.getPinnedConversations());
    const projectPins = new Set(this.getPinnedProjects().map(item => normalizeProjectPath(item)));
    const custom = this.getCustomProjects();
    const conversations = index.conversations.filter(item => !deleted?.has(item.id))
      .map(item => ({ ...item, pinned: pins.has(item.id) }))
      .sort(compareConversations);
    const byId = new Map(conversations.map(item => [item.id, item]));
    const projects = index.projects.map(project => {
      const items = project.conversations.map(item => byId.get(item.id))
        .filter((item): item is ConversationSummary => Boolean(item)).sort(compareConversations);
      const isCustom = custom.some(item => pathsEqual(item.path, project.path));
      return {
        ...project,
        custom: isCustom,
        pinned: projectPins.has(normalizeProjectPath(project.path)),
        conversations: items,
        firstConversationAt: items.length ? items.reduce((date, item) => item.createdAt < date ? item.createdAt : date, items[0].createdAt) : project.firstConversationAt,
        lastConversationAt: items.length ? items.reduce((date, item) => item.updatedAt > date ? item.updatedAt : date, items[0].updatedAt) : project.lastConversationAt,
      };
    }).filter(project => project.custom || project.conversations.length > 0)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastConversationAt.localeCompare(a.lastConversationAt));
    this.currentIndex = {
      ...index, projects, conversations,
      diagnostic: { ...index.diagnostic, conversationCount: conversations.length, projectCount: projects.length },
    };
    this.changeEmitter.fire(this.currentIndex);
  }

  private getCustomProjects(): CustomProject[] {
    return this.context.globalState.get<CustomProject[]>(CUSTOM_PROJECTS_KEY, []);
  }

  private getPinnedProjects(): string[] {
    return [...this.pinnedProjectPaths];
  }

  private getPinnedConversations(): string[] {
    return [...this.pinnedConversationIds];
  }

  private async savePins(key: typeof PINNED_PROJECTS_KEY | typeof PINNED_CONVERSATIONS_KEY, next: string[]): Promise<void> {
    const previous = key === PINNED_PROJECTS_KEY ? this.getPinnedProjects() : this.getPinnedConversations();
    try {
      await this.context.globalState.update(key, next);
    } catch (error) {
      // Memento updates its in-memory value before a storage error is reported.
      try { await this.context.globalState.update(key, previous); } catch { /* Keep the last successful local state. */ }
      throw error;
    }
    if (key === PINNED_PROJECTS_KEY) this.pinnedProjectPaths = [...next];
    else this.pinnedConversationIds = [...next];
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

function compareConversations(a: ConversationSummary, b: ConversationSummary): number {
  return Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt);
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
