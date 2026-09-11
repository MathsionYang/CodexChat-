import { promises as fs } from "node:fs";
import * as path from "node:path";

export function branchesEqual(first: string | undefined, second: string | undefined): boolean {
  return normalizeBranchName(first) === normalizeBranchName(second);
}

export async function readCurrentGitBranch(projectPath: string): Promise<string | undefined> {
  if (!projectPath.trim()) {
    return undefined;
  }

  const gitDirectory = await findGitDirectory(projectPath);
  if (!gitDirectory) {
    return undefined;
  }

  try {
    const head = await fs.readFile(path.join(gitDirectory, "HEAD"), "utf8");
    const match = /^ref:\s+refs\/heads\/(.+)$/m.exec(head.trim());
    return match?.[1]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function findGitDirectory(startPath: string): Promise<string | undefined> {
  let current = path.resolve(startPath);
  try {
    const stats = await fs.stat(current);
    if (!stats.isDirectory()) {
      current = path.dirname(current);
    }
  } catch {
    return undefined;
  }

  while (true) {
    const dotGit = path.join(current, ".git");
    try {
      const stats = await fs.stat(dotGit);
      if (stats.isDirectory()) {
        return dotGit;
      }
      if (stats.isFile()) {
        return await readLinkedGitDirectory(dotGit, current);
      }
    } catch {
      // Keep walking up until the filesystem root.
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function readLinkedGitDirectory(dotGitFile: string, repositoryPath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(dotGitFile, "utf8");
    const match = /^gitdir:\s*(.+)$/mi.exec(content.trim());
    const gitDirectory = match?.[1]?.trim();
    if (!gitDirectory) {
      return undefined;
    }
    return path.isAbsolute(gitDirectory) ? gitDirectory : path.resolve(repositoryPath, gitDirectory);
  } catch {
    return undefined;
  }
}

function normalizeBranchName(value: string | undefined): string {
  return (value ?? "").trim();
}
