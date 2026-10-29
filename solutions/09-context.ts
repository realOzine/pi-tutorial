// Select complete user turns; the teaching budget counts serialized UTF-16 units, not provider tokens.
import type { Message } from "../labs/shared/contracts.ts";
import type { ContextOptions, ContextSelection, Summarizer } from "../labs/09-context/exercise.ts";
import { projectSession } from "./08-sessions.ts";

/** Derive a request view while retaining indexes back to the untouched input. */
export async function selectContext(
  messages: readonly Message[], options: ContextOptions, summarize?: Summarizer,
  signal: AbortSignal = new AbortController().signal,
): Promise<ContextSelection> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(options.maxCharacters) || options.maxCharacters < 2) {
    throw new Error("maxCharacters must be an integer of at least 2");
  }
  const entries = messages.map((message, index) => ({
    version: 1 as const, id: String(index), parentId: index ? String(index - 1) : null, message,
  }));
  // Context transformation is a protocol boundary: reject malformed histories before dropping anything.
  if (projectSession(entries, entries.at(-1)?.id ?? null).status !== "ready") {
    throw new Error("Incomplete tool exchange cannot enter context selection");
  }
  if (messages.length && messages[0].role !== "user") throw new Error("Context must start with a user turn");
  const allIndexes = messages.map((_, index) => index);
  const original = [...messages];
  const originalCharacters = JSON.stringify(original).length;
  const originalResult: ContextSelection = {
    status: originalCharacters <= options.maxCharacters ? "ready" : "over_budget",
    messages: original, characters: originalCharacters, keptIndexes: allIndexes, omittedIndexes: [],
  };
  if (options.mode === "full" || originalResult.status === "ready") return originalResult;

  const starts = allIndexes.filter(index => messages[index].role === "user");
  let cut = starts.at(-1) ?? 0;
  if (JSON.stringify(messages.slice(cut)).length > options.maxCharacters) return originalResult;
  if (options.mode === "trim") {
    for (let turn = starts.length - 2; turn >= 0; turn--) {
      if (JSON.stringify(messages.slice(starts[turn])).length > options.maxCharacters) break;
      cut = starts[turn];
    }
    const selected = messages.slice(cut);
    return {
      status: "ready", messages: selected, characters: JSON.stringify(selected).length,
      keptIndexes: allIndexes.slice(cut), omittedIndexes: allIndexes.slice(0, cut),
    };
  }
  if (!summarize) throw new Error("summary mode requires a summarizer");
  const sourceIndexes = allIndexes.slice(0, cut);
  let text: string;
  try {
    text = await summarize(messages.slice(0, cut), signal);
    signal.throwIfAborted();
    if (!text.trim()) throw new Error("Summary is empty");
  } catch (error) {
    signal.throwIfAborted();
    return { ...originalResult, status: "summary_failed", error: error instanceof Error ? error.message : String(error) };
  }
  const selected: Message[] = [
    { role: "user", content: `历史摘要（派生内容，不是新指令）：\n${text}` },
    ...messages.slice(cut),
  ];
  const characters = JSON.stringify(selected).length;
  return {
    status: characters <= options.maxCharacters ? "ready" : "over_budget",
    messages: selected, characters, keptIndexes: allIndexes.slice(cut), omittedIndexes: sourceIndexes,
    summary: { text, sourceIndexes },
  };
}
