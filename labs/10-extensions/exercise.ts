// Lesson 10: compose tools and ordered context hooks without changing the agent loop.
import type { Message, Tool } from "../shared/contracts.ts";

export type Extension = {
  name: string;
  enabled?: boolean;
  tools?: readonly Tool[];
  beforeModel?: (messages: readonly Message[], signal: AbortSignal) => Promise<Message[]>;
  dispose?: () => Promise<void>;
};
export type ExtensionRuntime = {
  tools: Tool[];
  transformContext: (messages: readonly Message[], signal: AbortSignal) => Promise<Message[]>;
  dispose: () => Promise<void>;
};

/** Assemble enabled extensions with deterministic conflict, hook and cleanup rules. */
export function createExtensions(baseTools: readonly Tool[], extensions: readonly Extension[]): ExtensionRuntime {
  void baseTools; void extensions;
  throw new Error("TODO: register enabled tools, chain hooks, reject conflicts, dispose in reverse order");
}
