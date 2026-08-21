(function () {
  const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
  const root = document.getElementById("app");
  const view = document.body.dataset.view;
  const context = window.__CODEX_CHAT_CONTEXT__ || {};
  const locale = context.locale === "zh-CN" ? "zh-CN" : "en";
  const messages = context.messages || {};
  let sidebarState = null;
  let query = "";
  let isSearchComposing = false;
  let statsVisible = false;

  if (!root) return;

  if (view === "detail") {
    renderDetail(context.detail);
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
      root.innerHTML = `<div class="loading"><span class="codicon codicon-loading codicon-modifier-spin"></span>${text("webview.loading")}</div>`;
      return;
    }

    root.innerHTML = statsVisible ? renderProjectTokenStats(index) : selected ? renderConversations(selected, index) : renderProjects(index);
    bindSidebarEvents();
  }

  function renderProjects(index) {
    const filtered = index.projects.filter(project => `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase()));
    return `
      <div class="toolbar">
        <span class="toolbar-title">${text("webview.projectsTitle")}</span>
        ${iconButton("folder-opened", text("webview.chooseProjectFolder"), "choose-folder")}
        ${iconButton("refresh", text("webview.refresh"), "refresh")}
        ${iconButton("graph", text("webview.projectTokenStats"), "project-token-stats")}
        ${iconButton("info", text("webview.diagnostics"), "diagnostic")}
      </div>
      ${search(text("webview.searchProjects"))}
      ${index.diagnostic.warnings.length ? `<div class="warning">${escapeHtml(index.diagnostic.warnings[0])}</div>` : ""}
      <div class="section-label">${formatCount(index.projects.length, "webview.projectCount")}</div>
      ${filtered.map(project => `
        <button class="list-row" type="button" data-project-path="${escapeAttr(project.path)}">
          <span class="list-icon codicon codicon-${project.pathExists ? "folder" : "folder-unopened"}"></span>
          <span class="list-copy">
            <span class="list-name">${escapeHtml(project.name)}</span>
            <span class="list-meta">${escapeHtml(project.path || text("webview.noProjectPath"))} · ${formatRelative(project.lastConversationAt)}</span>
          </span>
          <span class="list-count">${project.conversations.length}</span>
        </button>
      `).join("") || `<div class="empty">${text("webview.noMatchingProjects")}</div>`}
    `;
  }

  function renderProjectTokenStats(index) {
    const rows = aggregateProjectTokens(index.projects);
    const filtered = rows.filter(project => `${project.name} ${project.path}`.toLowerCase().includes(query.toLowerCase()));
    const totalTokens = rows.reduce((sum, project) => sum + project.totalTokens, 0);
    const measuredConversations = rows.reduce((sum, project) => sum + project.measuredConversationCount, 0);
    const trackedProjects = rows.filter(project => project.measuredConversationCount > 0).length;
    const averageTokens = measuredConversations ? totalTokens / measuredConversations : 0;
    const maxTokens = Math.max(...filtered.map(project => project.totalTokens), 1);

    return `
      <div class="toolbar">
        <button id="back-stats" class="icon-button" type="button" aria-label="${text("webview.backToProjects")}"><span class="codicon codicon-arrow-left"></span></button>
        <span class="toolbar-title">${text("webview.projectTokenStats")}</span>
        ${iconButton("folder-opened", text("webview.chooseProjectFolder"), "choose-folder")}
        ${iconButton("refresh", text("webview.refresh"), "refresh")}
        ${iconButton("graph", text("webview.projectTokenStats"), "project-token-stats", true)}
        ${iconButton("info", text("webview.diagnostics"), "diagnostic")}
      </div>
      ${search(text("webview.searchProjectTokenStats"))}
      <section class="stats-summary" aria-label="${text("webview.projectTokenStats")}">
        <div class="stat-card">
          <span>${text("webview.totalProjectTokens")}</span>
          <strong title="${formatExactTokenCount(totalTokens)}">${formatTokenCount(totalTokens)}</strong>
        </div>
        <div class="stat-card">
          <span>${text("webview.averageConversationTokens")}</span>
          <strong title="${formatExactTokenCount(averageTokens)}">${formatTokenCount(averageTokens)}</strong>
        </div>
        <div class="stat-card">
          <span>${text("webview.trackedProjects")}</span>
          <strong>${trackedProjects}</strong>
        </div>
      </section>
      <div class="section-label">${formatCount(filtered.length, "webview.projectTokenCount")}</div>
      <div class="stats-list">
        ${filtered.map(project => projectTokenRow(project, totalTokens, maxTokens)).join("") || `<div class="empty">${text("webview.noProjectTokenStats")}</div>`}
      </div>
    `;
  }

  function projectTokenRow(project, allTokens, maxTokens) {
    const percent = allTokens ? (project.totalTokens / allTokens) * 100 : 0;
    const barWidth = Math.max(project.totalTokens ? (project.totalTokens / maxTokens) * 100 : 0, project.totalTokens ? 4 : 0);
    return `
      <button class="stats-row" type="button" data-project-path="${escapeAttr(project.path)}">
        <span class="list-icon codicon codicon-${project.pathExists ? "folder" : "folder-unopened"}"></span>
        <span class="stats-copy">
          <span class="stats-title-line">
            <span class="list-name">${escapeHtml(project.name)}</span>
            <span class="stats-total" title="${formatExactTokenCount(project.totalTokens)}">${formatTokenCount(project.totalTokens)}</span>
          </span>
          <span class="list-meta">${escapeHtml(project.path || text("webview.noProjectPath"))}</span>
          <span class="stats-bar" aria-hidden="true"><span style="width:${barWidth.toFixed(1)}%"></span></span>
          <span class="list-meta">${text("webview.conversationTokens", { count: project.conversationCount, tokens: formatTokenCount(project.averageTokens) })} - ${project.lastActive ? formatRelative(project.lastActive) : text("webview.noRecentActivity")} - ${text("webview.tokenShare", { percent: percent.toFixed(1) })}</span>
          <span class="list-meta">${text("webview.tokenBreakdown", { input: formatTokenCount(project.inputTokens), output: formatTokenCount(project.outputTokens), reasoning: formatTokenCount(project.reasoningOutputTokens) })}</span>
        </span>
      </button>
    `;
  }

  function aggregateProjectTokens(projects) {
    return projects.map(project => {
      const conversations = project.conversations || [];
      const measured = conversations.filter(conversation => conversation.tokenUsage);
      const totalTokens = conversations.reduce((sum, conversation) => sum + (conversation.tokenUsage?.totalTokens || 0), 0);
      const lastActiveMs = conversations.reduce((latest, conversation) => {
        const updatedAt = timestampMs(conversation.updatedAt);
        const createdAt = timestampMs(conversation.createdAt);
        return Math.max(latest, updatedAt, createdAt);
      }, 0);
      return {
        name: project.name,
        path: project.path,
        pathExists: project.pathExists,
        conversationCount: conversations.length,
        measuredConversationCount: measured.length,
        totalTokens,
        averageTokens: measured.length ? totalTokens / measured.length : 0,
        inputTokens: measured.reduce((sum, conversation) => sum + (conversation.tokenUsage?.inputTokens || 0), 0),
        outputTokens: measured.reduce((sum, conversation) => sum + (conversation.tokenUsage?.outputTokens || 0), 0),
        reasoningOutputTokens: measured.reduce((sum, conversation) => sum + (conversation.tokenUsage?.reasoningOutputTokens || 0), 0),
        lastActive: lastActiveMs ? new Date(lastActiveMs).toISOString() : project.lastConversationAt,
      };
    }).sort((first, second) => {
      if (second.totalTokens !== first.totalTokens) return second.totalTokens - first.totalTokens;
      return second.conversationCount - first.conversationCount;
    });
  }

  function timestampMs(value) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? 0 : date.valueOf();
  }

  function renderConversations(project, index) {
    const filtered = project.conversations.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
    return `
      <div class="project-head">
        <div class="project-title-row">
          <button id="back-projects" class="icon-button" type="button" aria-label="${text("webview.backToProjects")}"><span class="codicon codicon-arrow-left"></span></button>
          <strong>${escapeHtml(project.name)}</strong>
        </div>
        <div class="project-path">${escapeHtml(project.path)}</div>
        <div class="button-row">
          <button id="open-codex" class="button primary" type="button"><span class="codicon codicon-open-preview"></span>${text("webview.openCodex")}</button>
          <button id="new-codex" class="button" type="button"><span class="codicon codicon-new-file"></span>${text("webview.newConversation")}</button>
        </div>
      </div>
      ${search(text("webview.searchCurrentProjectConversations"))}
      <div class="section-label">${formatCount(filtered.length, "webview.conversationCount")}</div>
      ${filtered.map(item => `
        <div class="list-row" data-session-row="${item.id}">
          <span class="list-icon codicon codicon-${item.archived ? "archive" : "comment-discussion"}"></span>
          <button class="list-copy conversation-open" type="button" data-session-id="${item.id}">
            <span class="list-name">${escapeHtml(item.title)}</span>
            <span class="list-meta">${formatRelative(item.updatedAt)}${item.archived ? ` · ${text("webview.archived")}` : ""}</span>
          </button>
          <button class="icon-button resume" type="button" data-resume-id="${item.id}" aria-label="${text("webview.resumeConversation")}">
            <span class="codicon codicon-debug-continue"></span>
          </button>
        </div>
      `).join("") || `<div class="empty">${text("webview.noMatchingConversations")}</div>`}
      <div class="section-label">${text("webview.scannedAt", { date: formatDate(index.diagnostic.scannedAt) })}</div>
    `;
  }

  function search(placeholder) {
    return `<label class="search"><span class="codicon codicon-search"></span><input id="search" value="${escapeAttr(query)}" placeholder="${escapeAttr(placeholder)}" aria-label="${escapeAttr(placeholder)}"></label>`;
  }

  function iconButton(iconName, label, id, pressed = false) {
    return `<button id="${id}" class="icon-button" type="button" aria-label="${escapeAttr(label)}"${pressed ? ` title="${escapeAttr(label)}" aria-pressed="true"` : ""}><span class="codicon codicon-${iconName}"></span></button>`;
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
    root.querySelector("#project-token-stats")?.addEventListener("click", () => {
      statsVisible = true;
      query = "";
      renderSidebar();
    });
    root.querySelector("#diagnostic")?.addEventListener("click", () => post("showDiagnostic"));
    root.querySelector("#back-stats")?.addEventListener("click", () => {
      statsVisible = false;
      query = "";
      renderSidebar();
    });
    root.querySelector("#back-projects")?.addEventListener("click", () => {
      query = "";
      post("showProjects");
    });
    root.querySelector("#open-codex")?.addEventListener("click", () => post("openCodex", { mode: "open" }));
    root.querySelector("#new-codex")?.addEventListener("click", () => post("openCodex", { mode: "new" }));
    root.querySelectorAll("[data-project-path]").forEach(button => {
      button.addEventListener("click", () => {
        statsVisible = false;
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
      root.innerHTML = `<div class="empty">${text("webview.detailLoadFailed")}</div>`;
      return;
    }
    const summary = detail.summary;
    root.innerHTML = `
      <div class="detail-shell">
        <header class="detail-heading">
          <div class="detail-heading-copy">
            <div class="detail-path">${escapeHtml(summary.projectPath || text("webview.uncategorized"))}</div>
            <h1>${escapeHtml(summary.title)}</h1>
            <div class="detail-meta">
              <span><span class="codicon codicon-calendar"></span>${formatDate(summary.createdAt)}</span>
              <span><span class="codicon codicon-history"></span>${formatDate(summary.updatedAt)}</span>
              <span><span class="codicon codicon-${summary.archived ? "archive" : "record"}"></span>${summary.archived ? text("webview.archived") : text("webview.localConversation")}</span>
              <span><span class="codicon codicon-symbol-key"></span>${escapeHtml(summary.id)}</span>
            </div>
          </div>
          <div class="detail-actions">
            <button id="resume" class="button primary" type="button"><span class="codicon codicon-debug-continue"></span>${text("webview.resumeConversation")}</button>
            <button id="copy-id" class="button compact" type="button" aria-label="${text("webview.copySessionId")}"><span class="codicon codicon-copy"></span></button>
            <button id="reveal-file" class="button compact" type="button" aria-label="${text("webview.revealSessionFile")}"><span class="codicon codicon-folder-opened"></span></button>
          </div>
        </header>
        ${detail.malformedLineCount ? `<div class="warning">${text("webview.malformedLines", { count: detail.malformedLineCount })}</div>` : ""}
        ${detail.truncated ? `<div class="warning">${text("webview.truncated")}</div>` : ""}
        <section class="conversation" aria-label="${text("webview.conversationContent")}">
          ${detail.entries.map(entry => message(entry)).join("") || `<div class="empty">${text("webview.noMessages")}</div>`}
        </section>
      </div>
    `;
    root.querySelector("#resume")?.addEventListener("click", () => post("resumeConversation"));
    root.querySelector("#copy-id")?.addEventListener("click", () => post("copySessionId"));
    root.querySelector("#reveal-file")?.addEventListener("click", () => post("revealSessionFile"));
  }

  function message(entry) {
    const role = entry.kind === "user"
      ? text("webview.userRole")
      : entry.kind === "assistant"
        ? text("webview.assistantRole")
        : entry.kind === "tool"
          ? text("webview.toolRole")
          : text("webview.eventRole");
    const avatar = entry.kind === "user"
      ? text("webview.userAvatar")
      : entry.kind === "assistant"
        ? text("webview.assistantAvatar")
        : entry.kind === "tool"
          ? text("webview.toolAvatar")
          : text("webview.eventAvatar");
    return `
      <article class="message ${entry.kind}">
        <div class="message-avatar">${escapeHtml(avatar)}</div>
        <div>
          <div class="message-role">${escapeHtml(role)}${entry.createdAt ? `<span class="message-time">${formatDate(entry.createdAt)}</span>` : ""}</div>
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
    return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatRelative(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    const difference = date.valueOf() - Date.now();
    const absolute = Math.abs(difference);
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (absolute < 60 * 60 * 1000) return formatter.format(Math.round(difference / 60000), "minute");
    if (absolute < 24 * 60 * 60 * 1000) return formatter.format(Math.round(difference / 3600000), "hour");
    if (absolute < 7 * 24 * 60 * 60 * 1000) return formatter.format(Math.round(difference / 86400000), "day");
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
  }

  function formatCount(count, key) {
    return text(key, { count });
  }

  function formatTokenCount(value) {
    const count = Math.max(0, Number(value) || 0);
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: count < 10_000 ? 0 : 1,
    }).format(Math.round(count));
  }

  function formatExactTokenCount(value) {
    return new Intl.NumberFormat(locale).format(Math.round(Math.max(0, Number(value) || 0)));
  }

  function text(key, values = {}) {
    const template = messages[key] || key;
    return template.replace(/\{(\w+)\}/g, (_match, name) => values[name] === undefined ? "" : String(values[name]));
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
