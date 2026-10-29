// Validate a tool request and return a result linked to the original call.
import type { ModelResponse, Tool, ToolCall, ToolMessage } from "../shared/contracts.ts";

export async function executeToolCall(_call: ToolCall, _tools: readonly Tool[], _signal: AbortSignal): Promise<ToolMessage> {
  throw new Error("TODO 02: resolve the tool, validate arguments, execute and associate the result");
}

export async function executeResponseTools(_response: ModelResponse, _tools: readonly Tool[], _signal: AbortSignal): Promise<ToolMessage[]> {
  throw new Error("TODO 02: refuse truncated calls before executing a response's tools");
}
