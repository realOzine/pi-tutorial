// Schedule a validated batch while preserving source order in model-facing results.
import type { Tool, ToolCall, ToolMessage } from "../shared/contracts.ts";

export type BatchOptions = {
  execute: (call: ToolCall, tools: readonly Tool[], signal: AbortSignal) => Promise<ToolMessage>;
  onResult?: (result: ToolMessage) => void | Promise<void>;
};

/** Preflight the batch, run the selected policy, and return results in call order. */
export async function executeBatch(
  _calls: readonly ToolCall[],
  _tools: readonly Tool[],
  _signal: AbortSignal,
  _options: BatchOptions,
): Promise<ToolMessage[]> {
  throw new Error("TODO: 先预检，按工具声明选择串行或并行，按调用顺序返回全部结果");
}
