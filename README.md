# CodexChat

> A local-first VS Code companion for browsing, restoring, and understanding your OpenAI Codex sessions by project folder.

Current version: **0.1.6**

You can install it by searching **"CodexChat"** in the VS Code Marketplace.

Repository: <https://github.com/MathsionYang/CodexChat->

## Why CodexChat

OpenAI Codex stores local conversations under the user's `.codex` data directory. After you use Codex across many repositories, the history can become hard to browse:

- sessions from different projects are mixed together;
- it is difficult to find the conversation that belongs to a specific workspace;
- token usage is hard to understand at the project level;
- resuming an old local session often requires manual digging.

CodexChat solves this as a companion manager. It does not replace the official Codex extension. It organizes your existing local Codex records so you can browse, inspect, summarize, and hand off sessions back to Codex more easily.

## Privacy Model

CodexChat is designed to be local-first and read-only.

- It reads local `.codex` records from your machine.
- It does not upload conversation content.
- It does not sync data to any cloud service.
- It does not rewrite, move, or delete original Codex session files.
- It only uses the recorded `cwd` to group sessions by project folder.
- Deleted or missing project paths are excluded from project token totals.

The default data directory is:

```text
~/.codex
```

You can override it with the `codexChat.codexHome` setting.

## Features

### Project-based session browser

- Automatically scans `sessions` and `archived_sessions`.
- Reads `session_index.jsonl` when available for better titles.
- Groups local Codex conversations by the `cwd` recorded in each session.
- Shows only project folders that still exist on disk.
- Lets you manually add a project folder even before it has sessions.
- Refreshes automatically when local Codex session files change.

### Read-only conversation viewer

- Opens local Codex conversations in a read-only VS Code panel.
- Shows user messages, Codex replies, and tool-call summaries.
- Handles partially written or malformed JSONL lines safely.
- Truncates very large conversations after 2,000 records to keep the UI responsive.
- Lets you copy a conversation ID when needed.

### Project token statistics

- Summarizes Codex token usage by project folder.
- Shows total project tokens.
- Shows average tokens per conversation.
- Breaks usage down into input, cached input, cache write input, output, and reasoning output tokens when available.
- Excludes deleted project paths from token totals.

### Codex handoff

- Opens the selected project workspace before entering Codex.
- Calls the official Codex VS Code extension through registered VS Code commands.
- Can try to restore a selected local conversation in verified Codex versions.
- Falls back to opening the Codex sidebar and copying the conversation ID when direct restore is unavailable.
- Confirms workspace switching before opening a different project, unless disabled in settings.

### Internationalized UI

- English and Simplified Chinese UI strings are included.
- The extension follows the current VS Code language setting.

## Screenshots

### Project sessions

![CodexChat project conversation list](img/English-01.png)

### Conversation details

![CodexChat conversation details](img/English-02.png)

## Usage

1. Install CodexChat from the VS Code Marketplace by searching **"CodexChat"**.
2. Open the CodexChat view from the VS Code Activity Bar.
3. Select a detected project, or use the folder button to add a project manually.
4. Click a conversation to inspect its local read-only content.
5. Use the stats button to review token usage by project.
6. Click **Open Codex** to enter the official Codex extension for the selected project.
7. Click **Resume in Codex** beside a conversation to continue a supported local session.

## Settings

| Setting | Default | Description |
|---|---:|---|
| `codexChat.codexHome` | `""` | Codex data directory. Leave empty to use the current user's `.codex` folder. |
| `codexChat.includeArchivedSessions` | `true` | Include archived conversations from `archived_sessions`. |
| `codexChat.enableExperimentalSessionHandoff` | `true` | Allow CodexChat to try restoring history through the local conversation route. |
| `codexChat.confirmWorkspaceSwitch` | `true` | Confirm switching VS Code workspace before opening Codex for another project. |

## Compatibility Notes

CodexChat integrates with the official OpenAI Codex VS Code extension where possible.

- `chatgpt.openSidebar` is the public VS Code command currently used to open the Codex sidebar.
- Directly opening a specific local conversation depends on the internal `/local/:conversationId` route in compatible Codex versions.
- If direct restore is not available, CodexChat opens the Codex sidebar and copies the session ID so you do not lose the reference.

## Development

```powershell
npm.cmd install
npm.cmd test
npm.cmd run package
```

Press `F5` in VS Code to launch the Extension Development Host.

## What CodexChat Is Not

- It is not a replacement chat client.
- It does not implement its own Codex model interface.
- It does not modify Codex's original session storage.
- It does not send local conversation content to a server.

---

# CodexChat 中文说明

> CodexChat 是一个本地优先的 VS Code 伴生扩展，用于按项目文件夹浏览、恢复和理解 OpenAI Codex 本地会话。

当前版本：**0.1.6**

你可以直接在 VS Code 应用商店搜索 **"CodexChat"** 安装。

仓库地址：<https://github.com/MathsionYang/CodexChat->

## 解决什么痛点

OpenAI Codex 会把本地会话记录保存在用户机器的 `.codex` 数据目录中。随着你在多个项目中使用 Codex，会话历史很快会变得难以管理：

- 不同项目的会话混在一起；
- 很难快速找到某个工作区对应的历史对话；
- 很难按项目统计 token 消耗；
- 想继续某个历史会话时，经常需要手动翻找记录。

CodexChat 的定位是本地会话伴生管理器。它不替代官方 Codex 扩展，而是把已有的本地 Codex 记录按项目组织起来，方便浏览、查看、统计和回到 Codex 中继续工作。

## 隐私边界

CodexChat 采用本地优先、只读设计。

- 只读取你机器上的本地 `.codex` 记录。
- 不上传会话内容。
- 不做云同步。
- 不重写、移动或删除 Codex 原始会话文件。
- 只根据会话里记录的 `cwd` 将会话归入项目文件夹。
- 已删除或不存在的项目路径不会计入项目 token 统计。

默认数据目录为：

```text
~/.codex
```

也可以通过 `codexChat.codexHome` 设置手动指定。

## 现有功能

### 按项目浏览会话

- 自动扫描 `sessions` 和 `archived_sessions`。
- 在可用时读取 `session_index.jsonl` 来获得更好的会话标题。
- 根据每个会话中记录的 `cwd` 自动归类到项目文件夹。
- 只展示当前仍存在于磁盘上的项目路径。
- 支持手动添加项目文件夹。
- 监听本地 Codex 会话文件变化并自动刷新。

### 只读会话详情

- 在 VS Code 面板中只读查看本地 Codex 会话。
- 展示用户消息、Codex 回复和工具调用摘要。
- 对正在写入或格式异常的 JSONL 行做容错处理。
- 对超大对话限制展示前 2,000 条记录，避免界面卡顿。
- 支持复制会话 ID。

### 项目 Token 统计

- 按项目文件夹汇总 Codex token 用量。
- 展示项目总 token。
- 展示平均每个会话消耗。
- 在可用时拆分 input、cached input、cache write input、output、reasoning output。
- 已删除项目路径不会计入统计。

### 进入 Codex 与恢复会话

- 进入 Codex 前会先打开对应项目工作区。
- 通过 VS Code 命令调用官方 OpenAI Codex 扩展。
- 在经过验证的 Codex 版本中，尝试恢复指定本地历史会话。
- 如果直接恢复不可用，会降级为打开 Codex 侧栏并复制会话 ID。
- 默认在切换工作区前进行确认，也可以在设置中关闭。

### 中英文界面

- 内置英文和简体中文 UI 文案。
- 根据 VS Code 当前语言自动选择显示语言。

## 界面预览

### 项目会话

![CodexChat 项目会话列表](img/Snipaste_2026-08-19_15-30-30.png)

### 会话详情

![CodexChat 会话详情](img/Snipaste_2026-08-19_15-31-07.png)

## 使用方法

1. 在 VS Code 应用商店搜索 **"CodexChat"** 并安装。
2. 从 VS Code Activity Bar 打开 CodexChat。
3. 选择自动识别的项目，或通过文件夹按钮手动添加项目。
4. 点击会话，只读查看本地内容。
5. 点击统计按钮，查看按项目汇总的 token 使用情况。
6. 点击 **进入 Codex**，进入所选项目的官方 Codex 扩展。
7. 点击会话旁的 **在 Codex 中继续**，尝试恢复支持的本地历史会话。

## 设置项

| 设置项 | 默认值 | 说明 |
|---|---:|---|
| `codexChat.codexHome` | `""` | Codex 数据目录。留空时使用当前用户目录下的 `.codex` 文件夹。 |
| `codexChat.includeArchivedSessions` | `true` | 是否包含 `archived_sessions` 中的归档会话。 |
| `codexChat.enableExperimentalSessionHandoff` | `true` | 是否允许尝试通过本地会话路由恢复历史会话。 |
| `codexChat.confirmWorkspaceSwitch` | `true` | 打开另一个项目的 Codex 前，是否确认切换 VS Code 工作区。 |

## 兼容性说明

CodexChat 会尽量通过官方 OpenAI Codex VS Code 扩展已注册的 VS Code 命令进行集成。

- `chatgpt.openSidebar` 是当前用于打开 Codex 侧栏的公开 VS Code 命令。
- 直接打开指定本地会话依赖兼容版本中的内部 `/local/:conversationId` 路由。
- 如果直接恢复不可用，CodexChat 会打开 Codex 侧栏并复制会话 ID，避免丢失引用。

## 开发

```powershell
npm.cmd install
npm.cmd test
npm.cmd run package
```

在 VS Code 中按 `F5` 可启动 Extension Development Host。

## CodexChat 不是什么

- 不是新的聊天客户端。
- 不自己实现 Codex 模型接口。
- 不修改 Codex 原始会话存储。
- 不把本地会话内容发送到服务器。
