export interface ConversationSummary {
  id: string;
  projectId: string;
  projectPath: string;
  filePath: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  fileSize: number;
  fileModifiedAt: string;
  sourceVersion?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  normalizedPath: string;
  firstConversationAt: string;
  lastConversationAt: string;
  lastOpenedAt?: string;
  pathExists: boolean;
  custom: boolean;
  conversations: ConversationSummary[];
}

export interface ScanDiagnostic {
  codexHome: string;
  scannedAt: string;
  conversationCount: number;
  projectCount: number;
  failedFileCount: number;
  warnings: string[];
}

export interface SessionIndex {
  projects: ProjectSummary[];
  conversations: ConversationSummary[];
  diagnostic: ScanDiagnostic;
}

export type ConversationEntryKind = "user" | "assistant" | "tool" | "event" | "unknown";

export interface ConversationEntry {
  kind: ConversationEntryKind;
  content: string;
  createdAt?: string;
  sourceType: string;
}

export interface ConversationDetail {
  summary: ConversationSummary;
  entries: ConversationEntry[];
  truncated: boolean;
  malformedLineCount: number;
}

export interface PendingHandoff {
  projectPath: string;
  sessionId?: string;
  mode: "open" | "new" | "resume";
  createdAt: string;
}

export interface CustomProject {
  path: string;
  addedAt: string;
}
