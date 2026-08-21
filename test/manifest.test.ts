import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import test from "node:test";

test("uses color branding icon and monochrome activity bar icon", () => {
  const projectRoot = path.resolve(__dirname, "..", "..");
  const manifest = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  const activityBar = manifest.contributes.viewsContainers.activitybar[0];

  assert.equal(manifest.publisher, "MathsionYang");
  assert.equal(manifest.icon, "codexchat-icon-b-terminal.png");
  assert.equal(existsSync(path.join(projectRoot, manifest.icon)), true);
  assert.equal(activityBar.icon, "codexchat-icon-b-line.svg");
  assert.equal(existsSync(path.join(projectRoot, activityBar.icon)), true);
  assert.equal(manifest.displayName, "%manifest.displayName%");
  assert.equal(manifest.description, "%manifest.description%");
  assert.equal(manifest.contributes.views.codexChatContainer[0].name, "%manifest.view.projectSessions%");
  assert.equal(manifest.contributes.commands[0].title, "%command.refresh%");
  assert.equal(
    manifest.contributes.configuration.properties["codexChat.enableExperimentalSessionHandoff"].default,
    true,
  );
  assert.equal(existsSync(path.join(projectRoot, "package.nls.json")), true);
  assert.equal(existsSync(path.join(projectRoot, "package.nls.zh-cn.json")), true);
  assert.equal(existsSync(path.join(projectRoot, "package.nls.en.json")), true);
});
