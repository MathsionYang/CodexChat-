import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import test from "node:test";

test("keeps the conversation detail heading pinned while content scrolls", () => {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const stylesheet = readFileSync(path.join(projectRoot, "media", "webview.css"), "utf8");
  const headingRule = stylesheet.match(/\.detail-heading\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(headingRule, /position:\s*sticky/);
  assert.match(headingRule, /top:\s*0/);
  assert.match(headingRule, /z-index:\s*\d+/);
  assert.match(headingRule, /background:\s*var\(--vscode-editor-background\)/);
});
