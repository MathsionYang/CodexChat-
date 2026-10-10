import assert from "node:assert/strict";
import test from "node:test";
import { localize, messagesForLocale, resolveLocale } from "../src/i18n";

test("resolves VS Code language ids to supported CodexChat locales", () => {
  assert.equal(resolveLocale("zh-cn"), "zh-CN");
  assert.equal(resolveLocale("zh-hant"), "zh-CN");
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("fr"), "en");
  assert.equal(resolveLocale(undefined), "en");
});

test("formats localized messages with fallback interpolation", () => {
  assert.equal(
    localize("en", "sidebar.readError", { message: "bad file" }),
    "Unable to read conversation: bad file",
  );
  assert.equal(
    localize("zh-CN", "sidebar.readError", { message: "bad file" }),
    "无法读取会话：bad file",
  );
});

test("returns a complete dictionary for webviews", () => {
  const zh = messagesForLocale("zh-CN");
  const en = messagesForLocale("en");

  assert.equal(zh["webview.openCodex"], "进入 Codex");
  assert.equal(en["webview.openCodex"], "Open Codex");
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
});

test("management actions and destructive confirmations use the selected language", () => {
  assert.equal(localize("en", "webview.pinProject"), "Pin project");
  assert.equal(localize("en", "webview.pinConversation"), "Pin conversation");
  assert.match(localize("en", "delete.confirmConversation", { title: "Example" }), /Example.*cannot be undone/);
  assert.equal(localize("zh-CN", "webview.pinProject"), "置顶项目");
  assert.match(localize("zh-CN", "delete.confirmProject", { name: "测试", count: 2 }), /测试.*2.*不可撤销/);
});
