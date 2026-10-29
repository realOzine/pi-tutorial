// Separate preflight, execution completion order, and model-facing result order.
import type { Tool, ToolCall, ToolMessage } from "../labs/shared/contracts.ts";
import type { BatchOptions } from "../labs/07-scheduling/exercise.ts";

/** Settle every started operation before returning, including when an observer fails. */
export async function executeBatch(
  calls: readonly ToolCall[],
  tools: readonly Tool[],
  signal: AbortSignal,
  options: BatchOptions,
): Promise<ToolMessage[]> {
  if (new Set(calls.map((call) => call.id)).size !== calls.length) throw new Error("Duplicate tool call IDs");
  const preflight = calls.map((call): ToolMessage | undefined => {
    try {
      signal.throwIfAborted();
      const tool = tools.find((entry) => entry.definition.name === call.name);
      if (!tool) throw new Error(`Unknown tool: ${call.name}`);
      tool.validate(call.arguments);
      return undefined;
    } catch (error) {
      return { role: "tool", callId: call.id, content: error instanceof Error ? error.message : String(error), isError: true };
    }
  });
  const run = async (call: ToolCall, index: number): Promise<ToolMessage> => {
    let result = preflight[index];
    if (!result) {
      try {
        signal.throwIfAborted();
        result = await options.execute(call, tools, signal);
      } catch (error) {
        result = { role: "tool", callId: call.id, content: error instanceof Error ? error.message : String(error), isError: true };
      }
    }
    await options.onResult?.(result);
    return result;
  };
  const sequential = calls.some((call) => tools.find((tool) => tool.definition.name === call.name)?.execution === "sequential");
  if (sequential) {
    const results: ToolMessage[] = [];
    for (const [index, call] of calls.entries()) results.push(await run(call, index));
    return results;
  }
  // Unlike fail-fast Promise.all, observer failure cannot leave other tools running after return.
  const settled = await Promise.allSettled(calls.map(run));
  const failed = settled.find((entry) => entry.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return settled.map((entry) => {
    // All rejections were handled above; this branch makes the invariant explicit to TypeScript.
    if (entry.status === "rejected") throw entry.reason;
    return entry.value;
  });
}
