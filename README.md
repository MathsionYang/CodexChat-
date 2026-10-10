# CodexChat — Your Local Codex Conversation Manager

English | [简体中文](README.zh-CN.md)

> A local-first VS Code companion for organizing, viewing, pinning, deleting, tracking, and resuming OpenAI Codex conversations by project.
>
> Current version: **0.1.10** · [VSIX package](codexchat-0.1.10.vsix)

## Why CodexChat?

Codex stores local conversation records in its data directory, usually `~/.codex`. As you work across repositories, finding the right conversation and returning to its project can become difficult.

| Problem | How CodexChat helps |
| --- | --- |
| Conversations from different projects are mixed together | Groups local conversations by their recorded project folder |
| Finding a conversation's workspace takes manual effort | Shows the project path and opens the corresponding workspace |
| Token usage lacks a project view | Aggregates reported usage by project |
| Resuming an old conversation requires digging through files | Offers a resume action and a fallback that copies the conversation ID |
| The current Git branch may differ from the conversation's branch | Shows branch status and asks for confirmation before continuing on a different branch |

Your conversation data stays on your computer. CodexChat provides local management and hands active work back to the OpenAI Codex extension.

## Features

### Browse conversations by project

- Scans local `sessions` and, when enabled, `archived_sessions` records.
- Reads `session_index.jsonl` when available to display conversation titles.
- Groups conversations using the `cwd` recorded in each session.
- Displays projects whose folders currently exist on disk.
- Lets you add a project folder manually, including folders with no conversations yet.
- Watches local session files and refreshes the index when they change.

### Read-only conversation viewer

- Opens recognized user messages, Codex replies, and tool call summaries in a VS Code panel.
- Keeps the detail header and action buttons visible while scrolling.
- Tolerates malformed JSONL lines and files that are still being written.
- Limits very large conversations to the first 2,000 displayed records.
- Provides actions to copy the conversation ID and reveal the original session file.

### Project token statistics

- Shows reported token totals by project and average usage for conversations with usage data.
- Displays input, cached input, cache write input, output, and reasoning output values where available.
- Excludes conversations whose project folders no longer exist.
- Keeps a summary bar at the bottom of the sidebar, outside the scrolling list.

The project overview shows token usage across all indexed projects and the total project count. Inside a project, the token total applies to that project, while the project count remains global. Search filters do not change these totals; the archived-session setting changes the indexed scope.

Usage comes from records in local session files. Missing usage records do not contribute to totals. These figures are not an account balance, billing statement, or complete history of all Codex usage.

### Open and resume in Codex

- Opens the corresponding project workspace before entering Codex.
- Uses commands registered by the OpenAI Codex VS Code extension.
- Tries to open a specific historical conversation through the local conversation route.
- Falls back to opening the Codex sidebar and copying the conversation ID if direct restoration is unavailable.
- Asks before switching workspaces by default; this can be changed in settings.

### Git branch checks

- Shows the Git branch recorded in a conversation when that information is available.
- Compares it with the project's current branch before resuming.
- Warns about a mismatch and asks whether to continue, so you can decide whether to switch branches first.
- Supports filtering a project's conversations by the current branch when branch status is available.

### Pin projects and conversations

- Pins projects and conversations independently, placing pinned items before unpinned items.
- Highlights the pin button immediately when clicked; unpinning restores its normal color.
- Saves pin state in VS Code's global extension storage so it survives reloads.
- Updates the list directly, preserving scroll position and search input without waiting for a full scan.

### Confirmed permanent deletion

- Deletes a conversation from its list or detail panel only after a modal confirmation.
- Removes its local JSONL files, including archived copies with the same conversation ID, and clears its pin state.
- Shows a project's conversation count, including hidden archived sessions, before confirming project data deletion.
- Removes the confirmed project's recognized session files and local project metadata while keeping the actual project folder and source code.
- Updates lists and statistics directly after deletion and prevents older scans from restoring deleted rows.

Permanent deletion cannot be undone. If new conversations are created for a deleted project later, the project can appear again. These operations manage local JSONL files; they do not synchronize deletion with Codex desktop databases or cloud history.

### English and Simplified Chinese interface

The extension includes both languages and follows VS Code's language setting. This README uses English by default; the [Chinese README](README.zh-CN.md) is available separately.

## Screenshots

### Project conversations

![Project conversations](<img/会话详情.png>)

### Git branch status

![Git branch status](<img/分支显示.png>)

### Resume a conversation

![Resume a conversation](<img/会话恢复.png>)

### Token statistics

![Token statistics](<img/Token 统计.png>)

## Privacy and local storage

Conversation browsing and statistics read local Codex records. Pinning stores metadata in VS Code's extension storage. Permanent deletion requires confirmation and affects recognized session files within the managed session directories.

CodexChat does not upload conversation content, provide cloud synchronization, or edit conversation text. Project data deletion preserves project folders, source code, and other Codex data files.

The data directory is resolved in this order: `codexChat.codexHome`, the `CODEX_HOME` environment variable, then the current user's `~/.codex` folder.

## Quick start

Requires **VS Code 1.96.2 or later**. Install the OpenAI Codex extension to use the open, new conversation, and resume actions.

1. Search for **CodexChat** in the VS Code Marketplace, or run **Extensions: Install from VSIX...** and select `codexchat-0.1.10.vsix`.
2. Open CodexChat from the Activity Bar.
3. Choose a detected project, or use the folder button to add one.
4. Click a conversation to view its local contents.
5. Use the statistics button to explore project token usage.
6. Select **Open Codex** to continue working in the selected project's Codex extension.
7. Use **Resume in Codex** beside a conversation to resume its history.

Use the pin and delete buttons to manage projects or conversations. Deletion always asks for confirmation.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `codexChat.codexHome` | `""` | Codex data directory. When empty, uses `CODEX_HOME`, then the current user's `.codex` folder. |
| `codexChat.includeArchivedSessions` | `true` | Includes conversations from `archived_sessions` in lists and statistics. Project deletion always checks archived files. |
| `codexChat.enableExperimentalSessionHandoff` | `true` | Allows attempts to restore a historical conversation through the local conversation route. |
| `codexChat.confirmWorkspaceSwitch` | `true` | Asks before opening Codex in another project's workspace. |

## Compatibility

CodexChat uses `chatgpt.openSidebar` to open the OpenAI Codex extension's sidebar. Opening a specific historical conversation relies on the extension's internal `/local/:conversationId` route, whose availability may change between Codex versions. When direct restoration is unavailable, CodexChat opens the sidebar and copies the conversation ID.

CodexChat is a companion manager. It does not implement a separate chat client or call model APIs itself.

## Release notes

**0.1.9** added persistent project and conversation pins, confirmed permanent deletion, immediate list updates, and fixed token/project summary bars.

**0.1.10** excludes development documents and prototypes under `doc` from the VSIX. This avoids Marketplace upload collisions when different Chinese filenames are decoded as the same question-mark path. Documentation remains in the source repository; runtime resources and both interface languages are preserved.

See the [changelog](CHANGELOG.md) for details.

## Links

- [Source repository](https://github.com/MathsionYang/CodexChat-)
- [Chinese README](README.zh-CN.md)
- [Plugin guide (Chinese)](https://github.com/MathsionYang/CodexChat-/blob/main/doc/插件说明.md)
- [Feature development analysis (Chinese)](https://github.com/MathsionYang/CodexChat-/blob/main/doc/CodexChat功能发展分析报告.md)
