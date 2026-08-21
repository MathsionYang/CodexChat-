export type Locale = "zh-CN" | "en";
export type MessageKey = keyof typeof EN_MESSAGES;

const EN_MESSAGES = {
  "manifest.displayName": "CodexChat",
  "manifest.description": "Browse and restore local Codex conversations by project folder.",
  "manifest.view.projectSessions": "Project sessions",
  "command.refresh": "Refresh local sessions",
  "command.selectProject": "Select project folder",
  "command.openCodex": "Open Codex",
  "command.openSettings": "Open settings",
  "config.codexHome": "Codex data directory. Leave empty to use the current user's `.codex` folder.",
  "config.includeArchivedSessions": "Include archived conversations from `archived_sessions` in project conversations.",
  "config.enableExperimentalSessionHandoff": "Allow CodexChat to try restoring history through the local conversation route.",
  "config.confirmWorkspaceSwitch": "Confirm switching VS Code workspace before opening Codex for another project.",
  "common.unknown": "unknown",
  "sidebar.selectProjectOpenLabel": "Select project",
  "sidebar.selectProjectTitle": "Select a CodexChat project folder",
  "sidebar.chooseProject": "Choose project folder",
  "sidebar.noProjectSelected": "Please select a project in CodexChat first.",
  "sidebar.conversationMissing": "That conversation no longer exists. Refresh and try again.",
  "sidebar.readingConversation": "Reading Codex conversation...",
  "sidebar.readError": "Unable to read conversation: {message}",
  "sidebar.conversationGone": "That conversation has no project path, so it cannot be restored in Codex.",
  "sidebar.loading": "Scanning local sessions...",
  "sidebar.diagnosticCodexHome": "Codex directory",
  "sidebar.diagnosticProjectCount": "Projects",
  "sidebar.diagnosticConversationCount": "Conversations",
  "sidebar.diagnosticFailedFileCount": "Parse failures",
  "sidebar.diagnosticScannedAt": "Scanned at",
  "sidebar.diagnosticWarning": "Warning",
  "handoff.confirmOpenWorkspace": "Open the project workspace before entering Codex for {projectPath}?",
  "handoff.confirmOpenWorkspaceButton": "Open project and continue",
  "handoff.missingExtension": "OpenAI Codex VS Code extension is not installed.",
  "handoff.openMarketplace": "Open extension marketplace",
  "handoff.missingOpenSidebar": "The current Codex extension does not expose the `chatgpt.openSidebar` command.",
  "handoff.enterCodexError": "Unable to enter Codex: {message}",
  "handoff.sessionRestoreDisabled": "Direct conversation restore is disabled. Codex was opened and the conversation ID was copied.",
  "handoff.directRestoreFailed": "Could not open the conversation directly. Codex was opened and the conversation ID was copied.",
  "repository.homeMissing": "Codex data directory does not exist: {codexHome}",
  "repository.indexMalformed": "session_index.jsonl contains {count} unparsable lines.",
  "repository.fileReadError": "{fileName}: {message}",
  "repository.uncategorizedProject": "Uncategorized session",
  "repository.toolCall": "Tool call",
  "repository.fallbackTitleDate": "Codex session · {date}",
  "repository.fallbackTitleId": "Codex session · {id}",
  "conversation.copiedId": "Conversation ID copied.",
  "webview.loading": "Scanning local sessions...",
  "webview.projectsTitle": "Projects",
  "webview.chooseProjectFolder": "Choose project folder",
  "webview.refresh": "Refresh",
  "webview.diagnostics": "Diagnostics",
  "webview.projectTokenStats": "Project token stats",
  "webview.searchProjectTokenStats": "Search project token stats",
  "webview.totalProjectTokens": "Total tokens",
  "webview.averageConversationTokens": "Avg. per conversation",
  "webview.trackedProjects": "Tracked projects",
  "webview.projectTokenCount": "{count} project token rows",
  "webview.noProjectTokenStats": "No project token stats yet",
  "webview.conversationTokens": "{count} conversations - avg {tokens}",
  "webview.tokenShare": "{percent}% of total",
  "webview.tokenBreakdown": "Input {input} - Output {output} - Reasoning {reasoning}",
  "webview.noRecentActivity": "No conversations",
  "webview.searchProjects": "Search project folders",
  "webview.projectCount": "{count} projects",
  "webview.noProjectPath": "No project path",
  "webview.noMatchingProjects": "No matching projects",
  "webview.backToProjects": "Back to projects",
  "webview.openCodex": "Open Codex",
  "webview.newConversation": "New conversation",
  "webview.searchCurrentProjectConversations": "Search current project conversations",
  "webview.conversationCount": "{count} conversations",
  "webview.archived": "Archived",
  "webview.resumeConversation": "Resume in Codex",
  "webview.noMatchingConversations": "No matching conversations in this project",
  "webview.scannedAt": "Scanned at {date}",
  "webview.detailLoadFailed": "Could not load conversation details",
  "webview.uncategorized": "Uncategorized",
  "webview.localConversation": "Local conversation",
  "webview.copySessionId": "Copy conversation ID",
  "webview.revealSessionFile": "Open original file location",
  "webview.malformedLines": "This conversation has {count} unparsable lines, and the rest is shown below.",
  "webview.truncated": "This conversation is large, so only the first 2,000 records are shown.",
  "webview.conversationContent": "Conversation content",
  "webview.noMessages": "No user or assistant messages could be displayed.",
  "webview.userRole": "You",
  "webview.assistantRole": "Codex",
  "webview.toolRole": "Tool",
  "webview.eventRole": "Event",
  "webview.userAvatar": "U",
  "webview.assistantAvatar": "CX",
  "webview.toolAvatar": "T",
  "webview.eventAvatar": "E",
} as const;

type MessageDictionary = Record<MessageKey, string>;

const ZH_MESSAGES: MessageDictionary = {
  "manifest.displayName": "CodexChat",
  "manifest.description": "按项目文件夹浏览和恢复本地 Codex 会话。",
  "manifest.view.projectSessions": "项目会话",
  "command.refresh": "刷新本地会话",
  "command.selectProject": "选择项目文件夹",
  "command.openCodex": "进入 Codex",
  "command.openSettings": "打开设置",
  "config.codexHome": "Codex 数据目录。留空时使用当前用户目录下的 `.codex` 文件夹。",
  "config.includeArchivedSessions": "在项目会话中包含 `archived_sessions` 下的归档会话。",
  "config.enableExperimentalSessionHandoff": "允许 CodexChat 尝试通过本地会话路由恢复历史会话。",
  "config.confirmWorkspaceSwitch": "打开另一个项目的 Codex 前，先确认切换 VS Code 工作区。",
  "common.unknown": "未知",
  "sidebar.selectProjectOpenLabel": "选择项目",
  "sidebar.selectProjectTitle": "选择 CodexChat 项目文件夹",
  "sidebar.chooseProject": "选择项目文件夹",
  "sidebar.noProjectSelected": "请先在 CodexChat 中选择项目。",
  "sidebar.conversationMissing": "该会话已不存在，请刷新后重试。",
  "sidebar.readingConversation": "正在读取 Codex 会话...",
  "sidebar.readError": "无法读取会话：{message}",
  "sidebar.conversationGone": "该会话没有项目路径，无法在 Codex 中恢复。",
  "sidebar.loading": "正在扫描本地会话...",
  "sidebar.diagnosticCodexHome": "Codex 目录",
  "sidebar.diagnosticProjectCount": "项目",
  "sidebar.diagnosticConversationCount": "会话",
  "sidebar.diagnosticFailedFileCount": "解析失败",
  "sidebar.diagnosticScannedAt": "扫描时间",
  "sidebar.diagnosticWarning": "警告",
  "handoff.confirmOpenWorkspace": "需要打开项目工作区后再进入 Codex：{projectPath}",
  "handoff.confirmOpenWorkspaceButton": "打开项目并继续",
  "handoff.missingExtension": "未安装 OpenAI Codex VS Code 扩展。",
  "handoff.openMarketplace": "打开扩展市场",
  "handoff.missingOpenSidebar": "当前 Codex 扩展未提供 `chatgpt.openSidebar` 命令。",
  "handoff.enterCodexError": "无法进入 Codex：{message}",
  "handoff.sessionRestoreDisabled": "直接恢复会话已关闭。已打开 Codex 并复制会话 ID。",
  "handoff.directRestoreFailed": "未能直接定位会话，已打开 Codex 并复制会话 ID。",
  "repository.homeMissing": "Codex 数据目录不存在：{codexHome}",
  "repository.indexMalformed": "session_index.jsonl 中有 {count} 行无法解析。",
  "repository.fileReadError": "{fileName}：{message}",
  "repository.uncategorizedProject": "未归类会话",
  "repository.toolCall": "工具调用",
  "repository.fallbackTitleDate": "Codex 会话 · {date}",
  "repository.fallbackTitleId": "Codex 会话 · {id}",
  "conversation.copiedId": "会话 ID 已复制。",
  "webview.loading": "正在扫描本地会话...",
  "webview.projectsTitle": "项目",
  "webview.chooseProjectFolder": "选择项目文件夹",
  "webview.refresh": "刷新",
  "webview.diagnostics": "诊断信息",
  "webview.projectTokenStats": "项目 Token 统计",
  "webview.searchProjectTokenStats": "搜索项目 Token 统计",
  "webview.totalProjectTokens": "总 Token",
  "webview.averageConversationTokens": "平均每段会话",
  "webview.trackedProjects": "统计项目",
  "webview.projectTokenCount": "{count} 个项目 Token",
  "webview.noProjectTokenStats": "暂无项目 Token 统计",
  "webview.conversationTokens": "{count} 个会话 - 平均 {tokens}",
  "webview.tokenShare": "占总 Token {percent}%",
  "webview.tokenBreakdown": "输入 {input} - 输出 {output} - 推理 {reasoning}",
  "webview.noRecentActivity": "暂无会话",
  "webview.searchProjects": "搜索项目文件夹",
  "webview.projectCount": "{count} 个项目",
  "webview.noProjectPath": "没有项目路径",
  "webview.noMatchingProjects": "没有匹配的项目",
  "webview.backToProjects": "返回项目列表",
  "webview.openCodex": "进入 Codex",
  "webview.newConversation": "新建会话",
  "webview.searchCurrentProjectConversations": "搜索当前项目会话",
  "webview.conversationCount": "{count} 个会话",
  "webview.archived": "已归档",
  "webview.resumeConversation": "在 Codex 中继续",
  "webview.noMatchingConversations": "当前项目没有匹配的会话",
  "webview.scannedAt": "扫描于 {date}",
  "webview.detailLoadFailed": "无法加载会话详情",
  "webview.uncategorized": "未归类",
  "webview.localConversation": "本地会话",
  "webview.copySessionId": "复制会话 ID",
  "webview.revealSessionFile": "打开原始文件位置",
  "webview.malformedLines": "该会话有 {count} 行无法解析，已显示其余内容。",
  "webview.truncated": "会话内容较大，当前仅显示前 2000 条记录。",
  "webview.conversationContent": "会话内容",
  "webview.noMessages": "没有可显示的用户或助手消息。",
  "webview.userRole": "你",
  "webview.assistantRole": "Codex",
  "webview.toolRole": "工具",
  "webview.eventRole": "事件",
  "webview.userAvatar": "你",
  "webview.assistantAvatar": "CX",
  "webview.toolAvatar": "T",
  "webview.eventAvatar": "E",
};

export function resolveLocale(language: string | undefined): Locale {
  const normalized = (language ?? "").trim().toLowerCase();
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

export function messagesForLocale(locale: Locale): MessageDictionary {
  return locale === "zh-CN" ? ZH_MESSAGES : EN_MESSAGES;
}

export function localize(
  locale: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  const template = messagesForLocale(locale)[key] ?? EN_MESSAGES[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = values[name];
    return value === undefined ? "" : String(value);
  });
}

export function formatDate(locale: Locale, value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativeTime(locale: Locale, value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  const difference = date.valueOf() - Date.now();
  const absolute = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (absolute < 60 * 60 * 1_000) {
    return formatter.format(Math.round(difference / 60_000), "minute");
  }
  if (absolute < 24 * 60 * 60 * 1_000) {
    return formatter.format(Math.round(difference / 3_600_000), "hour");
  }
  if (absolute < 7 * 24 * 60 * 60 * 1_000) {
    return formatter.format(Math.round(difference / 86_400_000), "day");
  }
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}

export function webviewContext(locale: Locale, view: "sidebar" | "detail", payload: Record<string, unknown> = {}): string {
  return JSON.stringify({
    view,
    locale,
    messages: messagesForLocale(locale),
    ...payload,
  }).replaceAll("<", "\\u003c");
}
