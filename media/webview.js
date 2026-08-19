(function () {
  const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
  const root = document.getElementById("app");
  const view = document.body.dataset.view;
  let sidebarState = null;
  let query = "";
  let isSearchComposing = false;

  if (!root) return;

  if (view === "detail") {
    renderDetail(window.__CODEX_CHAT_DATA__?.detail);
    return;
  }

  window.addEventListener("message", event => {
    if (event.data?.type !== "state") return;
    sidebarState = event.data.payload;
    renderSidebar();
  });
  post("ready");

  function renderSidebar() {
    if (!sidebarState) return;
    const index = sidebarState.index;
    const selected = index.projects.find(project => samePath(project.path, sidebarState.selectedProjectPath));
    if (sidebarState.loading) {
      root.innerHTML = `<div class="loading"><span class="codicon codicon-loading codicon-modifier-spin"></span>正在扫描本地会话...</div>`;
      return;
    }

    root.innerHTML = selected ? renderConversations(selected, index) : renderProjects(index);
    bindSidebarEvents();
  }

  function renderProjects(index) {
    const filtered = index.projects.filter(project => `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase()));
    return `
      <div class="toolbar">
        <span class="toolbar-title">项目</span>
        ${iconButton("folder-opened", "选择项目文件夹", "choose-folder")}
        ${iconButton("refresh", "刷新", "refresh")}
        ${iconButton("info", "诊断信息", "diagnostic")}
      </div>
      ${search("搜索项目文件夹")}
      ${index.diagnostic.warnings.length ? `<div class="warning">${escapeHtml(index.diagnostic.warnings[0])}</div>` : ""}
      <div class="section-label">${filtered.length} 个项目</div>
      ${filtered.map(project => `
        <button class="list-row" type="button" data-project-path="${escapeAttr(project.path)}">
          <span class="list-icon codicon codicon-${project.pathExists ? "folder" : "folder-unopened"}"></span>
          <span class="list-copy">
            <span class="list-name">${escapeHtml(project.name)}</span>
            <span class="list-meta">${escapeHtml(project.path || "没有项目路径")} · ${formatRelative(project.lastConversationAt)}</span>
          </span>
          <span class="list-count">${project.conversations.length}</span>
        </button>
      `).join("") || `<div class="empty">没有匹配的项目</div>`}
    `;
  }

  function renderConversations(project, index) {
    const filtered = project.conversations.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
    return `
      <div class="project-head">
        <div class="project-title-row">
          <button id="back-projects" class="icon-button" type="button" aria-label="返回项目列表"><span class="codicon codicon-arrow-left"></span></button>
          <strong>${escapeHtml(project.name)}</strong>
        </div>
        <div class="project-path">${escapeHtml(project.path)}</div>
        <div class="button-row">
          <button id="open-codex" class="button primary" type="button"><span class="codicon codicon-open-preview"></span>进入 Codex</button>
          <button id="new-codex" class="button" type="button"><span class="codicon codicon-new-file"></span>新建会话</button>
        </div>
      </div>
      ${search("搜索当前项目会话")}
      <div class="section-label">${filtered.length} 个会话</div>
      ${filtered.map(item => `
        <div class="list-row" data-session-row="${item.id}">
          <span class="list-icon codicon codicon-${item.archived ? "archive" : "comment-discussion"}"></span>
          <button class="list-copy conversation-open" type="button" data-session-id="${item.id}">
            <span class="list-name">${escapeHtml(item.title)}</span>
            <span class="list-meta">${formatRelative(item.updatedAt)}${item.archived ? " · 已归档" : ""}</span>
          </button>
          <button class="icon-button resume" type="button" data-resume-id="${item.id}" aria-label="在 Codex 中继续">
            <span class="codicon codicon-debug-continue"></span>
          </button>
        </div>
      `).join("") || `<div class="empty">当前项目没有匹配的会话</div>`}
      <div class="section-label">扫描于 ${formatDate(index.diagnostic.scannedAt)}</div>
    `;
  }

  function search(placeholder) {
    return `<label class="search"><span class="codicon codicon-search"></span><input id="search" value="${escapeAttr(query)}" placeholder="${placeholder}" aria-label="${placeholder}"></label>`;
  }

  function iconButton(iconName, label, id) {
    return `<button id="${id}" class="icon-button" type="button" aria-label="${label}"><span class="codicon codicon-${iconName}"></span></button>`;
  }

  function bindSidebarEvents() {
    const searchInput = root.querySelector("#search");
    searchInput?.addEventListener("compositionstart", () => {
      isSearchComposing = true;
    });
    searchInput?.addEventListener("compositionend", event => {
      isSearchComposing = false;
      query = event.target.value;
      renderSidebar();
      restoreSearchFocus();
    });
    searchInput?.addEventListener("input", event => {
      query = event.target.value;
      if (isSearchComposing || event.isComposing) {
        return;
      }
      renderSidebar();
      restoreSearchFocus();
    });
    root.querySelector("#choose-folder")?.addEventListener("click", () => post("chooseFolder"));
    root.querySelector("#refresh")?.addEventListener("click", () => post("refresh"));
    root.querySelector("#diagnostic")?.addEventListener("click", () => post("showDiagnostic"));
    root.querySelector("#back-projects")?.addEventListener("click", () => {
      query = "";
      post("showProjects");
    });
    root.querySelector("#open-codex")?.addEventListener("click", () => post("openCodex", { mode: "open" }));
    root.querySelector("#new-codex")?.addEventListener("click", () => post("openCodex", { mode: "new" }));
    root.querySelectorAll("[data-project-path]").forEach(button => {
      button.addEventListener("click", () => {
        query = "";
        post("selectProject", { projectPath: button.dataset.projectPath });
      });
    });
    root.querySelectorAll("[data-session-id]").forEach(button => {
      button.addEventListener("click", () => post("openConversation", { sessionId: button.dataset.sessionId }));
    });
    root.querySelectorAll("[data-resume-id]").forEach(button => {
      button.addEventListener("click", () => post("resumeConversation", { sessionId: button.dataset.resumeId }));
    });
  }

  function restoreSearchFocus() {
    const searchInput = root.querySelector("#search");
    if (searchInput) {
      searchInput.focus();
      searchInput.setSelectionRange(query.length, query.length);
    }
  }

  function renderDetail(detail) {
    if (!detail) {
      root.innerHTML = `<div class="empty">无法加载会话详情</div>`;
      return;
    }
    const summary = detail.summary;
    root.innerHTML = `
      <div class="detail-shell">
        <header class="detail-heading">
          <div class="detail-heading-copy">
            <div class="detail-path">${escapeHtml(summary.projectPath || "未归类")}</div>
            <h1>${escapeHtml(summary.title)}</h1>
            <div class="detail-meta">
              <span><span class="codicon codicon-calendar"></span>${formatDate(summary.createdAt)}</span>
              <span><span class="codicon codicon-history"></span>${formatDate(summary.updatedAt)}</span>
              <span><span class="codicon codicon-${summary.archived ? "archive" : "record"}"></span>${summary.archived ? "已归档" : "本地会话"}</span>
              <span><span class="codicon codicon-symbol-key"></span>${escapeHtml(summary.id)}</span>
            </div>
          </div>
          <div class="detail-actions">
            <button id="resume" class="button primary" type="button"><span class="codicon codicon-debug-continue"></span>在 Codex 中继续</button>
            <button id="copy-id" class="button compact" type="button" aria-label="复制会话 ID"><span class="codicon codicon-copy"></span></button>
            <button id="reveal-file" class="button compact" type="button" aria-label="打开原始文件位置"><span class="codicon codicon-folder-opened"></span></button>
          </div>
        </header>
        ${detail.malformedLineCount ? `<div class="warning">有 ${detail.malformedLineCount} 行无法解析，已展示其余内容。</div>` : ""}
        ${detail.truncated ? `<div class="warning">会话内容较大，当前仅展示前 2000 条记录。</div>` : ""}
        <section class="conversation" aria-label="会话内容">
          ${detail.entries.map(entry => message(entry)).join("") || `<div class="empty">没有找到可展示的用户或助手消息</div>`}
        </section>
      </div>
    `;
    root.querySelector("#resume")?.addEventListener("click", () => post("resumeConversation"));
    root.querySelector("#copy-id")?.addEventListener("click", () => post("copySessionId"));
    root.querySelector("#reveal-file")?.addEventListener("click", () => post("revealSessionFile"));
  }

  function message(entry) {
    const role = entry.kind === "user" ? "你" : entry.kind === "assistant" ? "Codex" : entry.kind === "tool" ? "工具" : "事件";
    const avatar = entry.kind === "user" ? "你" : entry.kind === "assistant" ? "CX" : entry.kind === "tool" ? "T" : "E";
    return `
      <article class="message ${entry.kind}">
        <div class="message-avatar">${avatar}</div>
        <div>
          <div class="message-role">${role}${entry.createdAt ? `<span class="message-time">${formatDate(entry.createdAt)}</span>` : ""}</div>
          <div class="message-content">${escapeHtml(entry.content)}</div>
        </div>
      </article>
    `;
  }

  function post(type, payload = {}) {
    vscode?.postMessage({ type, ...payload });
  }

  function samePath(first, second) {
    if (!first || !second) return false;
    return first.replaceAll("/", "\\").replace(/[\\]+$/, "").toLowerCase()
      === second.replaceAll("/", "\\").replace(/[\\]+$/, "").toLowerCase();
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatRelative(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    const difference = date.valueOf() - Date.now();
    const absolute = Math.abs(difference);
    const formatter = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
    if (absolute < 60 * 60 * 1000) return formatter.format(Math.round(difference / 60000), "minute");
    if (absolute < 24 * 60 * 60 * 1000) return formatter.format(Math.round(difference / 3600000), "hour");
    if (absolute < 7 * 24 * 60 * 60 * 1000) return formatter.format(Math.round(difference / 86400000), "day");
    return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }
})();
