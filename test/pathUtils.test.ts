import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProjectPath, projectIdForPath, projectNameForPath } from "../src/pathUtils";

test("normalizes equivalent Windows paths consistently", () => {
  const first = normalizeProjectPath("D:\\Project\\Demo\\", "win32");
  const second = normalizeProjectPath("d:\\project\\demo", "win32");
  assert.equal(first, second);
});

test("creates stable project ids", () => {
  assert.equal(projectIdForPath("D:\\Project\\Demo"), projectIdForPath("D:\\Project\\Demo\\"));
  assert.notEqual(projectIdForPath("D:\\Project\\Demo"), projectIdForPath("D:\\Project\\Other"));
});

test("gets the final folder name", () => {
  assert.equal(projectNameForPath("D:\\Project\\Demo"), "Demo");
});
