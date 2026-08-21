import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import test from "node:test";

test("sidebar search preserves IME composition before re-rendering", () => {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const script = readFileSync(path.join(projectRoot, "media", "webview.js"), "utf8");

  assert.match(script, /compositionstart/);
  assert.match(script, /compositionend/);
  assert.match(script, /isSearchComposing\s*\|\|\s*event\.isComposing/);
});

test("project toolbar exposes token stats view", () => {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const script = readFileSync(path.join(projectRoot, "media", "webview.js"), "utf8");

  assert.match(script, /iconButton\("graph",\s*text\("webview\.projectTokenStats"\),\s*"project-token-stats"\)/);
  assert.match(script, /#project-token-stats/);
  assert.match(script, /renderProjectTokenStats/);
  assert.match(script, /aggregateProjectTokens/);
  assert.match(script, /tokenUsage\?\.totalTokens/);
});
