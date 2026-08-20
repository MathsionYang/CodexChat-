import * as fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import {
  ConversationDetail,
  ConversationEntry,
  ConversationSummary,
  CustomProject,
  ProjectSummary,
  SessionIndex,
} from "./models";
import { formatDate, Locale, localize } from "./i18n";
import { normalizeProjectPath, projectIdForPath, projectNameForPath } from "./pathUtils";

interface IndexedTitle {
  title: string;
  updatedAt?: string;
}

interface ParsedSessionMeta {
  id: string;
  cwd: string;
  createdAt: string;
  sourceVersion?: string;
}

interface ScanOptions {
  includeArchived: boolean;
  customProjects?: CustomProject[];
}

const MAX_DETAIL_ENTRIES = 2_000;

export class CodexSessionRepository {
  public constructor(
    private readonly codexHome: string,
    private readonly locale: Locale,
  ) {}

  public get home(): string {
    return this.codexHome;
  }

  public async scan(options: ScanOptions): Promise<SessionIndex> {
    const scannedAt = new Date().toISOString();
    const warnings: string[] = [];
    let failedFileCount = 0;

    const homeExists = await pathExists(this.codexHome);
    if (!homeExists) {
      return {
        projects: this.createCustomProjects(options.customProjects ?? []),
        conversations: [],
        diagnostic: {
          codexHome: this.codexHome,
          scannedAt,
          conversationCount: 0,
          projectCount: options.customProjects?.length ?? 0,
          failedFileCount: 0,
          warnings: [localize(this.locale, "repository.homeMissing", { codexHome: this.codexHome })],
        },
      };
    }

    const titles = await this.readSessionIndex(warnings);
    const activeFiles = await collectJsonlFiles(path.join(this.codexHome, "sessions"));
    const archivedFiles = options.includeArchived
      ? await collectJsonlFiles(path.join(this.codexHome, "archived_sessions"))
      : [];

    const byId = new Map<string, ConversationSummary>();
    for (const item of [
      ...activeFiles.map(filePath => ({ filePath, archived: false })),
      ...archivedFiles.map(filePath => ({ filePath, archived: true })),
    ]) {
      try {
        const summary = await this.readSummary(item.filePath, item.archived, titles);
        if (!summary) {
          failedFileCount += 1;
          continue;
        }

        const existing = byId.get(summary.id);
        if (!existing || shouldReplaceSummary(existing, summary)) {
          byId.set(summary.id, summary);
        }
      } catch (error) {
        failedFileCount += 1;
        warnings.push(localize(this.locale, "repository.fileReadError", {
          fileName: path.basename(item.filePath),
          message: toErrorMessage(error),
        }));
      }
    }

    const conversations = [...byId.values()].sort(compareConversationUpdatedDescending);
    const projects = await this.buildProjects(conversations, options.customProjects ?? []);
    return {
      projects,
      conversations,
      diagnostic: {
        codexHome: this.codexHome,
        scannedAt,
        conversationCount: conversations.length,
        projectCount: projects.length,
        failedFileCount,
        warnings: warnings.slice(0, 20),
      },
    };
  }

  public async readConversation(summary: ConversationSummary): Promise<ConversationDetail> {
    const entries: ConversationEntry[] = [];
    const fallbackEntries: ConversationEntry[] = [];
    let malformedLineCount = 0;
    let truncated = false;

    const stream = fs.createReadStream(summary.filePath, { encoding: "utf8" });
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        let record: unknown;
        try {
          record = JSON.parse(line);
        } catch {
          malformedLineCount += 1;
          continue;
        }

        const parsed = parseConversationRecord(record, this.locale);
        for (const entry of parsed.primary) {
          addDeduplicated(entries, entry);
        }
        for (const entry of parsed.fallback) {
          addDeduplicated(fallbackEntries, entry);
        }

        if (entries.length >= MAX_DETAIL_ENTRIES) {
          truncated = true;
          break;
        }
      }
    } finally {
      lines.close();
      stream.destroy();
    }

    return {
      summary,
      entries: entries.length > 0 ? entries.slice(0, MAX_DETAIL_ENTRIES) : fallbackEntries.slice(0, MAX_DETAIL_ENTRIES),
      truncated,
      malformedLineCount,
    };
  }

  private async readSessionIndex(warnings: string[]): Promise<Map<string, IndexedTitle>> {
    const indexPath = path.join(this.codexHome, "session_index.jsonl");
    const indexed = new Map<string, IndexedTitle>();
    if (!(await pathExists(indexPath))) {
      return indexed;
    }

    const stream = fs.createReadStream(indexPath, { encoding: "utf8" });
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let malformed = 0;
    try {
      for await (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          const value = JSON.parse(line) as Record<string, unknown>;
          const id = asNonEmptyString(value.id);
          const title = asNonEmptyString(value.thread_name);
          if (!id || !title) {
            continue;
          }
          const current = indexed.get(id);
          const updatedAt = asIsoString(value.updated_at);
          if (!current || compareDates(updatedAt, current.updatedAt) >= 0) {
            indexed.set(id, { title, updatedAt });
          }
        } catch {
          malformed += 1;
        }
      }
    } finally {
      lines.close();
      stream.destroy();
    }

    if (malformed > 0) {
      warnings.push(localize(this.locale, "repository.indexMalformed", { count: malformed }));
    }
    return indexed;
  }

  private async readSummary(
    filePath: string,
    archived: boolean,
    titles: Map<string, IndexedTitle>,
  ): Promise<ConversationSummary | undefined> {
    const meta = await readSessionMeta(filePath);
    if (!meta?.id) {
      return undefined;
    }

    const stats = await fsPromises.stat(filePath);
    const indexed = titles.get(meta.id);
    const projectPath = meta.cwd ? path.resolve(meta.cwd) : "";
    const projectId = projectIdForPath(projectPath);
    const createdAt = meta.createdAt || stats.birthtime.toISOString();
    const updatedAt = latestIso(indexed?.updatedAt, stats.mtime.toISOString(), createdAt);
    return {
      id: meta.id,
      projectId,
      projectPath,
      filePath,
      title: indexed?.title || (await readFirstUserMessage(filePath)) || fallbackTitle(meta.id, createdAt, this.locale),
      createdAt,
      updatedAt,
      archived,
      fileSize: stats.size,
      fileModifiedAt: stats.mtime.toISOString(),
      sourceVersion: meta.sourceVersion,
    };
  }

  private async buildProjects(
    conversations: ConversationSummary[],
    customProjects: CustomProject[],
  ): Promise<ProjectSummary[]> {
    const projects = new Map<string, ProjectSummary>();
    for (const conversation of conversations) {
      const project = projects.get(conversation.projectId);
      if (project) {
        project.conversations.push(conversation);
        project.firstConversationAt = earliestIso(project.firstConversationAt, conversation.createdAt);
        project.lastConversationAt = latestIso(project.lastConversationAt, conversation.updatedAt);
        continue;
      }

      const projectPath = conversation.projectPath;
      projects.set(conversation.projectId, {
        id: conversation.projectId,
        name: projectPath ? projectNameForPath(projectPath, localize(this.locale, "repository.uncategorizedProject")) : localize(this.locale, "repository.uncategorizedProject"),
        path: projectPath,
        normalizedPath: normalizeProjectPath(projectPath),
        firstConversationAt: conversation.createdAt,
        lastConversationAt: conversation.updatedAt,
        pathExists: projectPath ? await pathExists(projectPath) : false,
        custom: false,
        conversations: [conversation],
      });
    }

    for (const custom of customProjects) {
      const normalized = normalizeProjectPath(custom.path);
      if (!normalized) {
        continue;
      }
      const id = projectIdForPath(custom.path);
      if (projects.has(id)) {
        continue;
      }
      projects.set(id, {
        id,
        name: projectNameForPath(custom.path, localize(this.locale, "repository.uncategorizedProject")),
        path: path.resolve(custom.path),
        normalizedPath: normalized,
        firstConversationAt: custom.addedAt,
        lastConversationAt: custom.addedAt,
        pathExists: await pathExists(custom.path),
        custom: true,
        conversations: [],
      });
    }

    return [...projects.values()]
      .map(project => ({ ...project, conversations: project.conversations.sort(compareConversationUpdatedDescending) }))
      .sort((first, second) => compareDates(second.lastConversationAt, first.lastConversationAt));
  }

  private createCustomProjects(customProjects: CustomProject[]): ProjectSummary[] {
    return customProjects.map(custom => ({
      id: projectIdForPath(custom.path),
      name: projectNameForPath(custom.path, localize(this.locale, "repository.uncategorizedProject")),
      path: path.resolve(custom.path),
      normalizedPath: normalizeProjectPath(custom.path),
      firstConversationAt: custom.addedAt,
      lastConversationAt: custom.addedAt,
      pathExists: false,
      custom: true,
      conversations: [],
    }));
  }
}

async function collectJsonlFiles(directory: string): Promise<string[]> {
  if (!(await pathExists(directory))) {
    return [];
  }

  const files: string[] = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      continue;
    }
    let entries: fs.Dirent[];
    try {
      entries = await fsPromises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

async function readSessionMeta(filePath: string): Promise<ParsedSessionMeta | undefined> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let inspected = 0;
  try {
    for await (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      inspected += 1;
      try {
        const record = JSON.parse(line) as Record<string, unknown>;
        if (record.type !== "session_meta") {
          if (inspected >= 10) {
            break;
          }
          continue;
        }
        const payload = isRecord(record.payload) ? record.payload : {};
        const id = asNonEmptyString(payload.session_id) || asNonEmptyString(payload.id);
        if (!id) {
          return undefined;
        }
        return {
          id,
          cwd: asNonEmptyString(payload.cwd) || "",
          createdAt: asIsoString(payload.timestamp) || asIsoString(record.timestamp) || "",
          sourceVersion: asNonEmptyString(payload.cli_version),
        };
      } catch {
        if (inspected >= 10) {
          break;
        }
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return undefined;
}

async function readFirstUserMessage(filePath: string): Promise<string | undefined> {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let inspected = 0;
  try {
    for await (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      inspected += 1;
      try {
        const record = JSON.parse(line);
        const parsed = parseConversationRecord(record, "en");
        const user = parsed.primary.find(entry => entry.kind === "user")
          ?? parsed.fallback.find(entry => entry.kind === "user");
        if (user?.content) {
          return compactTitle(user.content);
        }
      } catch {
        // A partially written tail line should not hide the session.
      }
      if (inspected >= 200) {
        break;
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return undefined;
}

function parseConversationRecord(
  record: unknown,
  locale: Locale,
): { primary: ConversationEntry[]; fallback: ConversationEntry[] } {
  if (!isRecord(record)) {
    return { primary: [], fallback: [] };
  }
  const payload = isRecord(record.payload) ? record.payload : {};
  const timestamp = asIsoString(record.timestamp);
  const sourceType = asNonEmptyString(record.type) || "unknown";

  if (sourceType === "response_item") {
    const payloadType = asNonEmptyString(payload.type);
    const role = asNonEmptyString(payload.role);
    if (payloadType === "message" && (role === "user" || role === "assistant")) {
      const content = extractContent(payload.content);
      if (content) {
        return {
          primary: [{ kind: role, content, createdAt: timestamp, sourceType }],
          fallback: [],
        };
      }
    }

    if (payloadType === "function_call" || payloadType === "custom_tool_call") {
      const name = asNonEmptyString(payload.name) || localize(locale, "repository.toolCall");
      const argumentsText = asNonEmptyString(payload.arguments) || asNonEmptyString(payload.input);
      return {
        primary: [{
          kind: "tool",
          content: argumentsText ? `${name}\n${argumentsText}` : name,
          createdAt: timestamp,
          sourceType: payloadType,
        }],
        fallback: [],
      };
    }
  }

  if (sourceType === "event_msg") {
    const eventType = asNonEmptyString(payload.type);
    const content = asNonEmptyString(payload.message);
    if (eventType === "user_message" && content) {
      return { primary: [], fallback: [{ kind: "user", content, createdAt: timestamp, sourceType }] };
    }
    if (eventType === "agent_message" && content) {
      return { primary: [], fallback: [{ kind: "assistant", content, createdAt: timestamp, sourceType }] };
    }
  }

  return { primary: [], fallback: [] };
}

function extractContent(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (!Array.isArray(value)) {
    return "";
  }

  const parts: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      parts.push(item);
      continue;
    }
    if (!isRecord(item)) {
      continue;
    }
    const text = asNonEmptyString(item.text)
      || asNonEmptyString(item.input_text)
      || asNonEmptyString(item.output_text);
    if (text) {
      parts.push(text);
    }
  }
  return parts.join("\n\n").trim();
}

function addDeduplicated(entries: ConversationEntry[], entry: ConversationEntry): void {
  const previous = entries.at(-1);
  if (previous && previous.kind === entry.kind && previous.content === entry.content) {
    return;
  }
  entries.push(entry);
}

function shouldReplaceSummary(existing: ConversationSummary, candidate: ConversationSummary): boolean {
  if (existing.archived !== candidate.archived) {
    return existing.archived && !candidate.archived;
  }
  return compareDates(candidate.fileModifiedAt, existing.fileModifiedAt) > 0;
}

function compareConversationUpdatedDescending(first: ConversationSummary, second: ConversationSummary): number {
  return compareDates(second.updatedAt, first.updatedAt);
}

function compareDates(first?: string, second?: string): number {
  return Date.parse(first ?? "") - Date.parse(second ?? "");
}

function latestIso(...values: Array<string | undefined>): string {
  const valid = values.filter((value): value is string => (
    typeof value === "string" && !Number.isNaN(Date.parse(value))
  ));
  if (valid.length === 0) {
    return new Date(0).toISOString();
  }
  return valid.reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);
}

function earliestIso(...values: Array<string | undefined>): string {
  const valid = values.filter((value): value is string => (
    typeof value === "string" && !Number.isNaN(Date.parse(value))
  ));
  if (valid.length === 0) {
    return new Date(0).toISOString();
  }
  return valid.reduce((earliest, value) => Date.parse(value) < Date.parse(earliest) ? value : earliest);
}

function fallbackTitle(id: string, createdAt: string, locale: Locale): string {
  const date = Number.isNaN(Date.parse(createdAt)) ? "" : formatDate(locale, createdAt);
  return date
    ? localize(locale, "repository.fallbackTitleDate", { date })
    : localize(locale, "repository.fallbackTitleId", { id: id.slice(0, 8) });
}

function compactTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, " ").trim();
  return singleLine.length > 60 ? `${singleLine.slice(0, 60)}…` : singleLine;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asIsoString(value: unknown): string | undefined {
  const text = asNonEmptyString(value);
  return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsPromises.access(target);
    return true;
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
