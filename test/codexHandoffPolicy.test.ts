import assert from "node:assert/strict";
import test from "node:test";
import { shouldAttemptDirectSessionRestore } from "../src/codexHandoffPolicy";

test("attempts direct session restore for any Codex version when enabled", () => {
  assert.equal(shouldAttemptDirectSessionRestore(true, "26.814.12345"), true);
  assert.equal(shouldAttemptDirectSessionRestore(true, "26.818.31338"), true);
  assert.equal(shouldAttemptDirectSessionRestore(true, "27.0.0"), true);
  assert.equal(shouldAttemptDirectSessionRestore(true, undefined), true);
});

test("skips direct session restore only when the setting is disabled", () => {
  assert.equal(shouldAttemptDirectSessionRestore(false, "26.818.31338"), false);
});
