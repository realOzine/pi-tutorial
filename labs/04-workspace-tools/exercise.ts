// Learner-owned decisions: authorize a workspace path and require an unambiguous edit.
import type { Tool } from "../shared/contracts.ts";
import { createToolSet, type PathMode } from "./workspace.ts";

export async function resolveWorkspacePath(_root: string, _path: string, _mode: PathMode): Promise<string> {
  throw new Error("TODO 04: reject escaping, hidden, symbolic-link and non-file paths before any operation");
}

export function replaceExactlyOnce(_content: string, _oldText: string, _newText: string): string {
  throw new Error("TODO 04: require exactly one occurrence, including overlapping occurrences");
}

export async function createWorkspaceTools(root: string): Promise<Tool[]> {
  return createToolSet(root, resolveWorkspacePath, replaceExactlyOnce);
}
