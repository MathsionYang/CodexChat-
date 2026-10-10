import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import { messagesForLocale } from "../src/i18n";

function sidebar() {
  const dom = new JSDOM('<body data-view="sidebar"><main id="app"></main></body>', { runScripts: "outside-only" });
  const { window } = dom;
  const sent: Array<{ type: string; projectPath?: string; sessionId?: string }> = [];
  Object.assign(window, {
    __CODEX_CHAT_CONTEXT__: { locale: "en", messages: messagesForLocale("en") },
    acquireVsCodeApi: () => ({ postMessage: (message: typeof sent[number]) => sent.push(message) }),
  });
  window.eval(readFileSync(path.resolve(__dirname, "../../media/webview.js"), "utf8"));
  const conversation = {
    id: "session", title: "Example", pinned: false, updatedAt: "2026-10-10T00:00:00Z",
    tokenUsage: { totalTokens: 1234 },
  };
  const project = {
    path: "C:/example", name: "Example", pinned: false, pathExists: true,
    conversations: [conversation], lastConversationAt: conversation.updatedAt,
  };
  const state = {
    loading: false, selectedProjectPath: "",
    index: { projects: [project], conversations: [conversation], diagnostic: { warnings: [], scannedAt: conversation.updatedAt } },
  };
  const publish = () => window.dispatchEvent(new window.MessageEvent("message", { data: { type: "state", payload: state } }));
  publish();
  return { dom, window, sent, state, project, conversation, publish, document: window.document };
}

test("pin clicks immediately show pressed state and receive persisted state", t => {
  const f = sidebar();
  t.after(() => f.dom.window.close());
  let button = f.document.querySelector<HTMLButtonElement>("[data-project-pin]")!;
  assert.equal(button.getAttribute("aria-pressed"), "false");
  button.click();
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(button.title, "Unpin project");
  assert.equal(f.sent.at(-1)?.type, "toggleProjectPin");
  f.project.pinned = true;
  f.publish();
  button = f.document.querySelector<HTMLButtonElement>("[data-project-pin]")!;
  assert.equal(button.disabled, false);
  button.click();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  f.state.selectedProjectPath = f.project.path;
  f.publish();
  button = f.document.querySelector<HTMLButtonElement>("[data-pin-id]")!;
  button.click();
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(f.sent.at(-1)?.sessionId, "session");
  f.conversation.pinned = true;
  f.publish();
  button = f.document.querySelector<HTMLButtonElement>("[data-pin-id]")!;
  assert.equal(button.getAttribute("aria-pressed"), "true");
  button.click();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  f.conversation.pinned = false;
  f.publish();
  assert.equal(f.document.querySelector("[data-pin-id]")?.getAttribute("aria-pressed"), "false");
});

test("delete success updates rows and totals with the footer outside the scrolling list", t => {
  const f = sidebar();
  t.after(() => f.dom.window.close());
  const app = f.document.getElementById("app")!;
  const footer = app.querySelector(".project-summary-footer")!;
  assert.equal(footer.parentElement, app);
  assert.equal(footer.closest(".sidebar-scroll"), null);
  assert.equal(footer.querySelector("strong")?.title, "1,234");
  f.state.selectedProjectPath = f.project.path;
  f.publish();
  f.document.querySelector<HTMLButtonElement>("[data-delete-id]")!.click();
  assert.equal(f.sent.at(-1)?.type, "deleteConversation");
  assert.equal(f.document.querySelectorAll("[data-session-row]").length, 1, "confirmation must complete before removing the row");
  f.project.conversations.length = 0;
  f.state.index.conversations.length = 0;
  f.publish();
  assert.equal(f.document.querySelectorAll("[data-session-row]").length, 0);
  assert.equal(f.document.querySelector(".project-summary-footer strong")?.textContent, "0");
});

test("host updates preserve scroll and search selection and defer rendering during IME composition", t => {
  const f = sidebar();
  t.after(() => f.dom.window.close());
  f.document.querySelector<HTMLElement>(".sidebar-scroll")!.scrollTop = 120;
  let input = f.document.querySelector<HTMLInputElement>("#search")!;
  input.value = "Ex";
  input.dispatchEvent(new f.window.Event("input"));
  input = f.document.querySelector<HTMLInputElement>("#search")!;
  input.focus();
  input.setSelectionRange(1, 2);
  f.publish();
  input = f.document.querySelector<HTMLInputElement>("#search")!;
  assert.equal(f.document.activeElement, input);
  assert.equal(input.selectionStart, 1);
  assert.equal(input.selectionEnd, 2);
  assert.equal(f.document.querySelector<HTMLElement>(".sidebar-scroll")!.scrollTop, 120);
  input.dispatchEvent(new f.window.CompositionEvent("compositionstart"));
  input.value = "示例";
  input.dispatchEvent(new f.window.InputEvent("input", { isComposing: true }));
  f.publish();
  assert.equal(f.document.querySelector("#search"), input);
  input.dispatchEvent(new f.window.CompositionEvent("compositionend"));
  assert.equal(f.document.querySelector<HTMLInputElement>("#search")!.value, "示例");
});
