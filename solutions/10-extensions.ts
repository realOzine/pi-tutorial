// A small in-process extension seam; loaded code is trusted and is not sandboxed.
import type { Message, Tool } from "../labs/shared/contracts.ts";
import type { Extension, ExtensionRuntime } from "../labs/10-extensions/exercise.ts";
import { projectSession } from "./08-sessions.ts";

/** Build one extension lifetime; hooks run in declaration order and cleanup runs backwards. */
export function createExtensions(baseTools: readonly Tool[], extensions: readonly Extension[]): ExtensionRuntime {
  const enabled = extensions.filter(extension => extension.enabled !== false);
  const names = new Set<string>();
  const tools = [...baseTools];
  const toolNames = new Set<string>();
  let disposed = false;
  let disposal: Promise<void> | undefined;
  for (const tool of baseTools) {
    if (toolNames.has(tool.definition.name)) throw new Error(`Duplicate tool: ${tool.definition.name}`);
    toolNames.add(tool.definition.name);
  }
  for (const extension of enabled) {
    if (names.has(extension.name)) throw new Error(`Duplicate extension: ${extension.name}`);
    names.add(extension.name);
    for (const tool of extension.tools ?? []) {
      if (toolNames.has(tool.definition.name)) throw new Error(`Duplicate tool: ${tool.definition.name} from ${extension.name}`);
      toolNames.add(tool.definition.name);
      tools.push({
        ...tool,
        run: async (arguments_, signal) => {
          if (disposed) throw new Error(`Extension ${extension.name} is disposed`);
          signal.throwIfAborted();
          return tool.run(arguments_, signal);
        },
      });
    }
  }
  return {
    tools,
    async transformContext(messages, signal) {
      if (disposed) throw new Error("Extensions are disposed");
      signal.throwIfAborted();
      // Hooks may change nested content; a request view must not mutate durable conversation objects.
      let current = structuredClone([...messages]);
      for (const extension of enabled) {
        if (!extension.beforeModel) continue;
        try {
          current = await extension.beforeModel(current, signal);
          signal.throwIfAborted();
          const entries = current.map((message, index) => ({
            version: 1 as const, id: String(index), parentId: index ? String(index - 1) : null, message,
          }));
          if (projectSession(entries, entries.at(-1)?.id ?? null).status !== "ready") {
            throw new Error("Hook left an incomplete tool exchange");
          }
        } catch (error) {
          signal.throwIfAborted();
          throw new Error(`Extension ${extension.name} beforeModel failed`, { cause: error });
        }
      }
      return current;
    },
    dispose() {
      disposed = true;
      // Memoization makes concurrent cleanup callers wait for the same completion and failures.
      disposal ??= (async () => {
        const errors: Error[] = [];
        for (const extension of [...enabled].reverse()) {
          try { await extension.dispose?.(); }
          catch (error) { errors.push(new Error(`Extension ${extension.name} dispose failed`, { cause: error })); }
        }
        if (errors.length) throw new AggregateError(errors, "Extension cleanup failed");
      })();
      return disposal;
    },
  };
}

/** Assemble explicit instruction sources as text; this does not grant execution permissions. */
export function composeInstructions(base: string, project: string, skills: readonly { name: string; description: string }[]): string {
  const sections = [base];
  if (project.trim()) sections.push(`项目约定（操作者明确加载）：\n${project}`);
  if (skills.length) sections.push(`可选技能说明（需要时再读取正文）：\n${skills.map(skill => `${skill.name}: ${skill.description}`).join("\n")}`);
  return sections.join("\n\n");
}
