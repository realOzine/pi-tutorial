// Workspace path and exact-edit reference for a stable, trusted local fixture directory.
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { Tool } from "../labs/shared/contracts.ts";
import { createToolSet, type PathMode } from "../labs/04-workspace-tools/workspace.ts";

/** Create the four course tools with the reference path and edit policies. */
export async function createWorkspaceTools(root: string): Promise<Tool[]> {
  return createToolSet(root, resolveWorkspacePath, replaceExactlyOnce);
}

/** Reject stable path escapes and aliases; this is not an OS sandbox against concurrent attackers. */
export async function resolveWorkspacePath(root: string, path: string, mode: PathMode): Promise<string> {
  if (!path || isAbsolute(path) || path.includes("\\") || path.includes("\0")) throw new Error("Expected a relative workspace path");
  const parts = path.split("/");
  if (parts.some((part) => !part || part.startsWith("."))) throw new Error("Empty, dot, parent and hidden path segments are not allowed");
  const canonicalRoot = await realpath(root);
  let current = canonicalRoot;
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]);
    const last = i === parts.length - 1;
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error("Symbolic links are not allowed");
      if (last && (!info.isFile() || info.nlink !== 1)) throw new Error("Expected a regular file with one hard link");
      if (!last && !info.isDirectory()) throw new Error("Parent path is not a directory");
    } catch (error: unknown) {
      if (last && mode === "new-or-existing" && error instanceof Error && "code" in error && error.code === "ENOENT") return current;
      throw error;
    }
  }
  const canonical = await realpath(current);
  const inside = relative(canonicalRoot, canonical);
  if (!inside || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) throw new Error("Path escapes workspace");
  return canonical;
}

/** Return changed content only when oldText occurs once, including overlapping matches. */
export function replaceExactlyOnce(content: string, oldText: string, newText: string): string {
  if (!oldText) throw new Error("oldText must not be empty");
  const first = content.indexOf(oldText);
  if (first < 0) throw new Error("oldText was not found; read the current file before editing");
  if (content.indexOf(oldText, first + 1) >= 0) throw new Error("oldText is not unique; include more surrounding text");
  return content.slice(0, first) + newText + content.slice(first + oldText.length);
}
