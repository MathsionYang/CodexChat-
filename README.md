# CodexChat

CodexChat 是 OpenAI Codex VS Code 扩展的本地会话伴生管理器。它读取本机 `.codex` 数据目录，按会话中的 `cwd` 将历史会话归入项目文件夹。

## 功能

- 自动扫描 `sessions` 和 `archived_sessions`。
- 按项目文件夹浏览本地 Codex 会话。
- 查看用户消息、Codex 回复和工具调用摘要。
- 监听本地会话变化并刷新。
- 打开项目工作区并进入官方 Codex 扩展。
- 在经过验证的 Codex 版本中恢复指定本地会话。
- Codex 原始会话文件全程只读。

## 使用

1. 打开 VS Code Activity Bar 中的 CodexChat。
2. 从自动识别的项目中选择一个项目，或使用文件夹选择器添加项目。
3. 点击会话查看只读内容。
4. 点击“进入 Codex”开始工作，或点击会话右侧的继续按钮恢复历史会话。

默认数据目录为当前用户目录下的 `.codex`。可通过 `codexChat.codexHome` 设置覆盖。

## 界面预览

### 项目会话

![CodexChat 项目会话列表](img/Snipaste_2026-08-19_15-30-30.png)

### 会话详情

![CodexChat 会话详情](img/Snipaste_2026-08-19_15-31-07.png)

## 开发

```powershell
npm.cmd install
npm.cmd test
npm.cmd run package
```

按 `F5` 可启动 Extension Development Host。

## 兼容性说明

`chatgpt.openSidebar` 是当前 OpenAI Codex 扩展公开注册的 VS Code 命令。指定历史会话的直接跳转依赖当前版本中的内部 `/local/:conversationId` 路由，CodexChat 仅对已验证版本启用，并在不兼容时降级为打开 Codex 侧栏和复制会话 ID。
