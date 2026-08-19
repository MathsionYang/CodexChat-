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
