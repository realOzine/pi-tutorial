// Tool protocol reference: invalid calls become feedback; cancellation remains control flow.
import type { ModelResponse, Tool, ToolCall, ToolMessage } from "../labs/shared/contracts.ts";

/** Execute one call after validation and keep its ID in success and error results. */
export async function executeToolCall(call: ToolCall, tools: readonly Tool[], signal: AbortSignal): Promise<ToolMessage> {
  signal.throwIfAborted();
  try {
    const matches = tools.filter((tool) => tool.definition.name === call.name);
    if (matches.length === 0) throw new Error(`Unknown tool: ${call.name}`);
    if (matches.length > 1) throw new Error(`Ambiguous tool registration: ${call.name}`);
    const tool = matches[0];
    tool.validate(call.arguments);
    signal.throwIfAborted();
    const content = await tool.run(call.arguments, signal);
    signal.throwIfAborted();
    return { role: "tool", callId: call.id, content, isError: false };
  } catch (error: unknown) {
    // Cancellation is a runtime decision, not evidence for the model to retry a tool.
    signal.throwIfAborted();
    return { role: "tool", callId: call.id, content: error instanceof Error ? error.message : String(error), isError: true };
  }
}

/** Reject every call from a length-limited response, even if its arguments parse. */
export async function executeResponseTools(response: ModelResponse, tools: readonly Tool[], signal: AbortSignal): Promise<ToolMessage[]> {
  signal.throwIfAborted();
  const calls = response.message.toolCalls;
  if (new Set(calls.map((call) => call.id)).size !== calls.length) throw new Error("Duplicate tool call IDs");
  if (response.stopReason === "length") {
    return calls.map((call) => ({ role: "tool", callId: call.id, isError: true,
      content: "Response truncated; tool not executed. Re-issue complete arguments." }));
  }
  const results: ToolMessage[] = [];
  for (const call of calls) results.push(await executeToolCall(call, tools, signal));
  return results;
}
