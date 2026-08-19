import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import test from "node:test";

test("uses the requested terminal icon for the activity bar", () => {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const manifest = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  const activityBar = manifest.contributes.viewsContainers.activitybar[0];

  assert.equal(activityBar.icon, "codexchat-icon-b-terminal.svg");
  assert.equal(existsSync(path.join(projectRoot, activityBar.icon)), true);
});
