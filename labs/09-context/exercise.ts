// Lesson 09: select request context without rewriting the original conversation.
import type { Message } from "../shared/contracts.ts";

export type ContextOptions = { mode: "full" | "trim" | "summary"; maxCharacters: number };
export type Summarizer = (messages: readonly Message[], signal: AbortSignal) => Promise<string>;
export type ContextSelection = {
  status: "ready" | "over_budget" | "summary_failed";
  messages: Message[];
  characters: number;
  keptIndexes: number[];
  omittedIndexes: number[];
  summary?: { text: string; sourceIndexes: number[] };
  error?: string;
};

/** Choose complete user turns, with provenance and an explicit budget failure. */
export async function selectContext(
  messages: readonly Message[], options: ContextOptions, summarize?: Summarizer,
  signal: AbortSignal = new AbortController().signal,
): Promise<ContextSelection> {
  void messages; void options; void summarize; void signal;
  throw new Error("TODO: keep complete turns, compare full/trim/summary, preserve originals on failure");
}
