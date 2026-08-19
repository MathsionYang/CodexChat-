# CodexChat 进入 Codex VS Code 扩展设计

## 1. 设计目标

用户在 CodexChat 中选择项目后，可以完成两类操作：

1. 进入该项目的 Codex 工作区，开始新工作。
2. 选择该项目的一个本地历史会话，在 Codex 中继续。

CodexChat 只负责项目和会话管理，不承担聊天能力。实际对话仍由 OpenAI Codex VS Code 扩展处理。

## 2. 已确认的本机扩展能力

本机安装的扩展信息：

```text
扩展 ID：openai.chatgpt
扩展名称：Codex
版本：26.814.41407
```

该版本在 `package.json` 中公开注册了以下相关命令：

```text
chatgpt.openSidebar      打开 Codex 侧栏
chatgpt.newCodexPanel    新建 Codex Agent
chatgpt.newChat          在 Codex 侧栏中新建聊天
chatgpt.addToThread      将内容添加到当前 Codex 会话
```

其中 `chatgpt.openSidebar` 和 `chatgpt.newCodexPanel` 可以由伴生扩展通过 VS Code 命令系统调用。

本机扩展代码还注册了 URI Handler，并在 Webview 路由中包含：

```text
/local/:conversationId
```

因此当前版本存在以下直接会话入口：

```text
vscode://openai.chatgpt/local/<conversationId>
```

该路由不是官方公开 API，只能视为经过本机版本验证的兼容能力，不能作为没有降级方案的唯一入口。

## 3. 用户交互方案

### 3.1 选择项目

用户进入 CodexChat 后先选择项目。选择项目只改变 CodexChat 当前筛选范围，不立即离开管理器。

选择项目后展示：

- 项目路径。
- 项目会话数量。
- 项目会话列表。
- “进入 Codex”按钮。

这样用户可以先判断要开始新工作，还是继续某个历史会话。

### 3.2 进入项目的 Codex

用户点击“进入 Codex”时：

1. 检查目标项目是否为当前 VS Code 工作区。
2. 如果是当前工作区，执行 `chatgpt.openSidebar`。
3. 如果不是当前工作区，先保存待处理跳转，再调用 `vscode.openFolder`。
4. VS Code 工作区重新加载后，CodexChat 恢复待处理跳转。
5. 激活 `openai.chatgpt` 扩展。
6. 执行 `chatgpt.openSidebar`。

如果用户点击“新建 Codex 会话”，最后一步改为执行 `chatgpt.newCodexPanel` 或 `chatgpt.newChat`。

### 3.3 在 Codex 中继续历史会话

用户选择会话并点击“在 Codex 中继续”时：

1. 完成目标工作区切换。
2. 执行 `chatgpt.openSidebar`，确保 Codex 视图已经显示。
3. 对通过兼容性检查的 Codex 版本，打开：

```text
vscode://openai.chatgpt/local/<conversationId>
```

4. 如果直接路由不可用，降级为仅打开 Codex 侧栏。
5. 保留会话 ID 的复制入口，方便用户定位和诊断。

## 4. 为什么要先切换工作区

Codex 会话的 `cwd` 表示会话原本所属项目。直接在其他工作区恢复会话可能造成：

- Codex 获取到错误的工作区上下文。
- 文件引用无法定位。
- 工具操作作用于错误目录。
- 用户误以为正在操作历史项目。

因此“切换项目工作区”必须发生在“打开 Codex 会话”之前。

## 5. 跨工作区跳转状态

调用 `vscode.openFolder` 后，VS Code 会重新加载扩展宿主，当前内存状态会消失。CodexChat 必须先把待跳转信息写入 `globalState`：

```json
{
  "projectPath": "D:\\项目\\CheckMCP",
  "sessionId": "01a018bb-3ae3-7740-adb7-cc355180f5f5",
  "mode": "resume",
  "createdAt": "2026-08-19T06:50:00.000Z"
}
```

扩展重新激活后：

1. 读取待跳转状态。
2. 校验当前工作区是否与 `projectPath` 匹配。
3. 校验状态是否过期，建议有效期不超过 2 分钟。
4. 执行 Codex 打开或恢复动作。
5. 成功或失败后清除待跳转状态，避免重复执行。

## 6. 扩展可用性检查

执行跳转前检查：

```javascript
const codex = vscode.extensions.getExtension("openai.chatgpt");
```

处理规则：

- 未安装：提示安装 OpenAI Codex 扩展，并提供打开扩展市场的操作。
- 已安装但未激活：调用 `codex.activate()`。
- `chatgpt.openSidebar` 执行失败：显示兼容性错误并保留在 CodexChat。
- 版本不在已验证范围：只执行 `chatgpt.openSidebar`，不使用私有会话路由。

## 7. 推荐实现流程

```text
选择项目
    ↓
查看该项目会话
    ↓
进入 Codex / 在 Codex 中继续
    ↓
目标项目是当前工作区？
    ├─ 是：继续
    └─ 否：保存 pending handoff → openFolder → 扩展重新激活
    ↓
检查并激活 openai.chatgpt
    ↓
执行 chatgpt.openSidebar
    ↓
是否指定历史会话且版本已验证？
    ├─ 是：打开 vscode://openai.chatgpt/local/<sessionId>
    └─ 否：停留在 Codex 侧栏
```

## 8. 原型消息协议

`交互原型.html` 在 VS Code Webview 中运行时，通过消息把操作交给扩展宿主：

```javascript
vscode.postMessage({
  type: "openInCodex",
  projectPath: "D:\\项目\\CheckMCP",
  sessionId: "01a018bb-3ae3-7740-adb7-cc355180f5f5",
  mode: "resume"
});
```

页面 JavaScript 不直接调用 VS Code 命令。真正的 `vscode.commands.executeCommand`、`vscode.openFolder` 和 URI 打开操作由扩展宿主执行。

## 9. 风险与降级

### 风险一：官方命令 ID 发生变化

`chatgpt.openSidebar` 当前出现在扩展公开贡献清单中，但仍属于另一个扩展提供的命令。调用前应使用 `vscode.commands.getCommands()` 检查命令是否存在。

### 风险二：`/local/:conversationId` 路由发生变化

该路由来自本机安装版本的内部实现，不是公开文档接口。建议维护“已验证版本范围”，不匹配时禁止直接跳转历史会话。

### 风险三：工作区重新加载导致动作丢失

必须在 `openFolder` 前持久化待跳转状态，并设置过期时间和单次消费机制。

### 风险四：会话所属目录不存在

禁止直接恢复。提示用户重新选择项目目录，或只在 CodexChat 中只读查看历史内容。

### 风险五：Codex 无法加载会话

降级为打开 Codex 侧栏，同时提供复制会话 ID、打开原始 JSONL 和返回 CodexChat 的操作。

## 10. 当前结论

第一版应把 `chatgpt.openSidebar` 作为稳定主入口，把 `/local/<conversationId>` 作为版本受控的增强入口。

产品体验上不应在用户选择项目后立即强制离开 CodexChat。更合理的流程是先进入该项目的会话列表，再由用户选择“进入 Codex”或“在 Codex 中继续”。这样既保留项目级管理价值，也能把实际工作自然交还给官方 Codex 扩展。
