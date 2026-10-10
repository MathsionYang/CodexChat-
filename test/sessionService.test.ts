import assert from "node:assert/strict";
import { promises as fs, readFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test, { TestContext } from "node:test";
import type { SessionService } from "../src/sessionService";
import type { SessionIndex } from "../src/models";
import { CodexSessionRepository } from "../src/codexSessionRepository";

// VS Code is provided only inside the extension host. Keep file parsing and storage real.
async function fixture(t: TestContext, includeArchived = true) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "codexchat-actions-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const project = path.join(temporary, "project");
  const sessions = path.join(temporary, "sessions");
  await fs.mkdir(project);
  await fs.mkdir(sessions);
  const sessionId = "pin-delete-session";
  const sessionFile = path.join(sessions, "rollout-example.jsonl");
  await fs.writeFile(sessionFile, JSON.stringify({
    type: "session_meta",
    payload: { id: sessionId, cwd: project, timestamp: "2026-10-10T00:00:00Z" },
  }) + "\n");
  const state = new Map<string, unknown>();
  const changes: SessionIndex[] = [];
  let configurationListener!: (event: { affectsConfiguration(key: string): boolean }) => void;
  const vscode = {
    env: { language: "en" },
    EventEmitter: class {
      listeners: Array<(value: SessionIndex) => void> = [];
      event = (listener: (value: SessionIndex) => void) => {
        this.listeners.push(listener);
        return { dispose() {} };
      };
      fire(value: SessionIndex) { this.listeners.forEach(listener => listener(value)); }
      dispose() {}
    },
    Uri: { file: (value: string) => ({ fsPath: value }) },
    RelativePattern: class {},
    workspace: {
      getConfiguration: () => ({ get: (key: string, fallback: unknown) => (
        key === "codexHome" ? temporary : key === "includeArchivedSessions" ? includeArchived : fallback
      ) }),
      onDidChangeConfiguration: (listener: typeof configurationListener) => {
        configurationListener = listener;
        return { dispose() {} };
      },
      createFileSystemWatcher: () => ({
        onDidCreate() {}, onDidChange() {}, onDidDelete() {}, dispose() {},
      }),
    },
  };
  const filename = path.resolve(__dirname, "..", "src", "sessionService.js");
  const requireFromModule = createRequire(filename);
  const module = { exports: {} };
  runInNewContext(readFileSync(filename, "utf8"), {
    module, exports: module.exports, process, setTimeout, clearTimeout,
    require: (name: string) => name === "vscode" ? vscode : requireFromModule(name),
  }, { filename });
  const Service = (module.exports as { SessionService: new (context: unknown) => SessionService }).SessionService;
  const context = { globalState: {
    get: (key: string, fallback: unknown) => state.has(key) ? state.get(key) : fallback,
    update: async (key: string, value: unknown) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      state.set(key, value);
    },
  } };
  const service = new Service(context);
  service.onDidChange(index => changes.push(index));
  t.after(() => service.dispose());
  await service.refresh();
  changes.length = 0;
  return { service, state, changes, project, sessionId, sessionFile, temporary, Service, context,
    changeArchiveSetting: () => configurationListener({ affectsConfiguration: key => key === "codexChat.includeArchivedSessions" }),
  };
}

test("project and conversation pin changes publish without scanning session files", async t => {
  const f = await fixture(t);
  let scans = 0;
  const original = f.service.repository.scan.bind(f.service.repository);
  f.service.repository.scan = async options => { scans += 1; return original(options); };
  await f.service.toggleProjectPin(f.project);
  await f.service.toggleConversationPin(f.sessionId);
  assert.equal(scans, 0, "pinning must not wait for a full scan");
  assert.equal(f.changes.length, 2);
  assert.equal(f.service.index.projects[0].pinned, true);
  assert.equal(f.service.index.conversations[0].pinned, true);
  const restarted = new f.Service(f.context);
  t.after(() => restarted.dispose());
  await restarted.refresh();
  assert.equal(restarted.index.projects[0].pinned, true);
  assert.equal(restarted.index.conversations[0].pinned, true);
  await f.service.toggleConversationPin(f.sessionId);
  assert.equal(f.service.index.conversations[0].pinned, false);
});

function sidebarActions(f: Awaited<ReturnType<typeof fixture>>, choice?: string) {
  const prompts: Array<{ text: string; options: { modal?: boolean }; button: string }> = [];
  const errors: string[] = [];
  const filename = path.resolve(__dirname, "..", "src", "sidebarProvider.js");
  const requireFromModule = createRequire(filename);
  const module = { exports: {} };
  runInNewContext(readFileSync(filename, "utf8"), {
    module, exports: module.exports,
    require: (name: string) => {
      if (name === "vscode") return {
        env: { language: "en" },
        window: {
          showWarningMessage: async (text: string, options: { modal?: boolean }, button: string) => {
            prompts.push({ text, options, button });
            return choice === "confirm" ? button : undefined;
          },
          showErrorMessage: (text: string) => { errors.push(text); },
        },
      };
      if (name === "./conversationPanel") return { ConversationPanel: {} };
      if (name === "./webviewUtils") return {};
      return requireFromModule(name);
    },
  }, { filename });
  const Provider = (module.exports as { SidebarProvider: new (...args: unknown[]) => {
    onMessage(message: unknown): Promise<void>; dispose(): void;
  } }).SidebarProvider;
  const provider = new Provider(f.context, f.service, {});
  return { provider, prompts, errors };
}

test("canceling either deletion confirmation leaves files and the index intact", async t => {
  const f = await fixture(t);
  const ui = sidebarActions(f);
  t.after(() => ui.provider.dispose());
  await ui.provider.onMessage({ type: "deleteConversation", sessionId: f.sessionId });
  await ui.provider.onMessage({ type: "deleteProject", projectPath: f.project });
  assert.equal(ui.prompts.length, 2);
  assert.equal(ui.prompts.every(prompt => prompt.options.modal === true), true);
  assert.equal(f.service.index.conversations.length, 1);
  assert.equal((await fs.stat(f.sessionFile)).isFile(), true);
  assert.equal(ui.errors.length, 0);
});

test("confirmed project deletion counts hidden archives and publishes its result", async t => {
  const f = await fixture(t, false);
  const archive = path.join(f.temporary, "archived_sessions");
  await fs.mkdir(archive);
  const file = path.join(archive, "archived.jsonl");
  await fs.writeFile(file, JSON.stringify({ type: "session_meta", payload: { id: "archive", cwd: f.project } }) + "\n");
  const ui = sidebarActions(f, "confirm");
  t.after(() => ui.provider.dispose());
  await ui.provider.onMessage({ type: "deleteProject", projectPath: f.project });
  assert.match(ui.prompts[0].text, /2 local conversations.*archived.*cannot be undone/);
  assert.equal(f.changes.at(-1)?.projects.length, 0);
  await assert.rejects(fs.stat(file), { code: "ENOENT" });
  assert.equal((await fs.stat(f.project)).isDirectory(), true);
});

test("failed pin persistence keeps the old state and reports the action error", async t => {
  const f = await fixture(t);
  f.context.globalState.update = async (key, value) => {
    // VS Code updates its Memento cache before the storage write can reject.
    f.state.set(key, value);
    throw new Error("storage unavailable");
  };
  const ui = sidebarActions(f);
  t.after(() => ui.provider.dispose());
  await ui.provider.onMessage({ type: "toggleProjectPin", projectPath: f.project });
  assert.equal(f.service.index.projects[0].pinned, false);
  assert.equal(f.changes.length, 0);
  assert.match(ui.errors[0], /storage unavailable/);
  await f.service.refresh();
  assert.equal(f.service.index.projects[0].pinned, false);
  assert.equal((f.state.get("codexChat.pinnedProjects") as string[]).length, 0);
});

test("deleting a conversation immediately publishes the updated list without a full scan", async t => {
  const f = await fixture(t);
  let scans = 0;
  const original = f.service.repository.scan.bind(f.service.repository);
  f.service.repository.scan = async options => { scans += 1; return original(options); };
  await f.service.deleteConversation(f.service.index.conversations[0]);
  assert.equal(scans, 0);
  assert.equal(f.changes.at(-1)?.conversations.length, 0);
  assert.equal(f.service.index.diagnostic.conversationCount, 0);
  await assert.rejects(fs.stat(f.sessionFile), { code: "ENOENT" });
  assert.equal((await fs.stat(f.project)).isDirectory(), true);
});

test("an in-flight scan cannot undo a pin or resurrect a deleted conversation", { timeout: 1500 }, async t => {
  const f = await fixture(t);
  const stale = f.service.index;
  let finish!: (index: SessionIndex) => void;
  f.service.repository.scan = () => new Promise(resolve => { finish = resolve; });
  const scan = f.service.refresh();
  await f.service.toggleProjectPin(f.project);
  await f.service.deleteConversation(f.service.index.conversations[0]);
  finish(stale);
  await scan;
  assert.equal(f.service.index.conversations.length, 0);
  assert.equal(f.service.index.projects.some(project => project.conversations.length > 0), false);
});

test("an in-flight scan uses the latest pin state", { timeout: 1500 }, async t => {
  const f = await fixture(t);
  const stale = f.service.index;
  let finish!: (index: SessionIndex) => void;
  f.service.repository.scan = () => new Promise(resolve => { finish = resolve; });
  const scan = f.service.refresh();
  await f.service.toggleProjectPin(f.project);
  await f.service.toggleConversationPin(f.sessionId);
  finish(stale);
  await scan;
  assert.equal(f.service.index.projects[0].pinned, true);
  assert.equal(f.service.index.projects[0].conversations[0].pinned, true);
});

test("rapid pin clicks are applied in order and survive a restart", async t => {
  const f = await fixture(t);
  await Promise.all([
    f.service.toggleConversationPin(f.sessionId),
    f.service.toggleConversationPin(f.sessionId),
  ]);
  assert.equal(f.service.index.conversations[0].pinned, false);
  const restarted = new f.Service(f.context);
  t.after(() => restarted.dispose());
  await restarted.refresh();
  assert.equal(restarted.index.conversations[0].pinned, false);
});

test("project deletion removes archived sessions even when archived sessions are hidden", async t => {
  const f = await fixture(t, false);
  const archive = path.join(f.temporary, "archived_sessions");
  await fs.mkdir(archive);
  const archivedFile = path.join(archive, "archived.jsonl");
  await fs.writeFile(archivedFile, JSON.stringify({
    type: "session_meta", payload: { id: "archived-id", cwd: f.project },
  }) + "\n");
  await f.service.deleteProject(f.service.index.projects[0]);
  await assert.rejects(fs.stat(archivedFile), { code: "ENOENT" });
  assert.equal(f.service.index.projects.length, 0);
  assert.equal(f.service.index.conversations.length, 0);
  assert.equal((await fs.stat(f.project)).isDirectory(), true);
});

test("a partially failed project deletion publishes only the files still present", async t => {
  const f = await fixture(t);
  const blocked = path.join(f.temporary, "sessions", "zz-blocked.jsonl");
  await fs.writeFile(blocked, JSON.stringify({ type: "session_meta", payload: { id: "blocked", cwd: f.project } }) + "\n");
  await f.service.refresh();
  const unlink = fs.unlink.bind(fs);
  t.mock.method(fs, "unlink", async (file: string) => {
    if (file === blocked) throw Object.assign(new Error("file locked"), { code: "EPERM" });
    await unlink(file);
  });
  await assert.rejects(f.service.deleteProject(f.service.index.projects[0]), /file locked/);
  assert.equal(f.service.index.conversations.length, 1);
  assert.equal(f.service.index.conversations[0].id, "blocked");
  await assert.rejects(fs.stat(f.sessionFile), { code: "ENOENT" });
  assert.equal((await fs.stat(blocked)).isFile(), true);
});

test("project deletion still updates the list when metadata cleanup fails", async t => {
  const f = await fixture(t);
  f.context.globalState.update = async () => { throw new Error("storage unavailable"); };
  await assert.rejects(f.service.deleteProject(f.service.index.projects[0]), /storage unavailable/);
  await assert.rejects(fs.stat(f.sessionFile), { code: "ENOENT" });
  assert.equal(f.service.index.conversations.length, 0);
  assert.equal(f.changes.at(-1)?.diagnostic.conversationCount, 0);
});

test("a failed duplicate deletion keeps the surviving archive readable despite an old scan", async t => {
  const f = await fixture(t);
  const archive = path.join(f.temporary, "archived_sessions");
  await fs.mkdir(archive);
  const archivedFile = path.join(archive, "copy.jsonl");
  await fs.copyFile(f.sessionFile, archivedFile);
  const stale = f.service.index;
  const originalScan = f.service.repository.scan.bind(f.service.repository);
  let finish!: (index: SessionIndex) => void;
  let scanning = false;
  f.service.repository.scan = options => {
    if (scanning) return originalScan(options);
    scanning = true;
    return new Promise(resolve => { finish = resolve; });
  };
  const scan = f.service.refresh();
  const unlink = fs.unlink.bind(fs);
  t.mock.method(fs, "unlink", async (file: string) => {
    if (file === archivedFile) throw Object.assign(new Error("archive locked"), { code: "EPERM" });
    await unlink(file);
  });
  await assert.rejects(f.service.deleteProject(f.service.index.projects[0]), /archive locked/);
  assert.equal(f.service.index.conversations[0].filePath, archivedFile);
  finish(stale);
  await scan;
  assert.equal(f.service.index.conversations[0].filePath, archivedFile);
  assert.ok(await f.service.repository.readConversation(f.service.index.conversations[0]));
});

test("an archive setting change during deletion cannot resurrect the old file", async t => {
  const f = await fixture(t);
  const stale = f.service.index;
  const repository = f.service.repository;
  const originalDelete = repository.deleteConversation.bind(repository);
  let start!: () => void;
  const started = new Promise<void>(resolve => { start = resolve; });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  repository.deleteConversation = async summary => { start(); await gate; await originalDelete(summary); };
  const deletion = f.service.deleteConversation(stale.conversations[0]);
  await started;
  let finish!: (index: SessionIndex) => void;
  t.mock.method(CodexSessionRepository.prototype, "scan", () => new Promise<SessionIndex>(resolve => { finish = resolve; }));
  f.changeArchiveSetting();
  const scan = f.service.refresh();
  release();
  await deletion;
  finish(stale);
  await scan;
  assert.equal(f.service.index.conversations.length, 0);
});

test("a session archived after project confirmation stays visible and requests reconfirmation", async t => {
  const f = await fixture(t);
  const project = f.service.index.projects[0];
  const targets = await f.service.repository.listProjectSessionFiles(f.project);
  const archive = path.join(f.temporary, "archived_sessions");
  await fs.mkdir(archive);
  const moved = path.join(archive, "moved.jsonl");
  await fs.rename(f.sessionFile, moved);
  await assert.rejects(f.service.deleteProject(project, targets), /confirm again/);
  assert.equal((await fs.stat(moved)).isFile(), true);
  await f.service.refresh();
  assert.equal(f.service.index.conversations[0].filePath, moved);
});

test("unreadable deletion directories abort without removing a known session", async t => {
  const f = await fixture(t);
  t.mock.method(fs, "readdir", async () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }); });
  await assert.rejects(f.service.repository.deleteProject(f.project), { code: "EACCES" });
  assert.equal((await fs.stat(f.sessionFile)).isFile(), true);
});
