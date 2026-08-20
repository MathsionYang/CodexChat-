import { createHash } from "node:crypto";
import * as path from "node:path";

export function normalizeProjectPath(input: string, platform = process.platform): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = path.normalize(path.resolve(trimmed)).replace(/[\\/]+$/, "");
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function projectIdForPath(input: string): string {
  const normalized = normalizeProjectPath(input);
  if (!normalized) {
    return "unclassified";
  }
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function projectNameForPath(input: string, fallback = "Uncategorized"): string {
  const normalized = path.normalize(input);
  return path.basename(normalized) || normalized || fallback;
}

export function pathsEqual(first: string, second: string): boolean {
  return normalizeProjectPath(first) === normalizeProjectPath(second);
}
