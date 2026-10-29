// Keep streaming preview separate from the one completed assistant response.
import type { ModelResponse, ToolCall } from "../labs/shared/contracts.ts";
import type { StreamListener, StreamPart } from "../labs/05-streaming/exercise.ts";

/** Commit one complete response; malformed, interrupted, or unfinished streams never commit. */
export async function consumeStream(
  parts: AsyncIterable<StreamPart>,
  signal: AbortSignal,
  onEvent: StreamListener = () => {},
): Promise<ModelResponse> {
  let content = "";
  const pending = new Map<string, { id: string; name: string; argumentsText: string }>();
  signal.throwIfAborted();
  for await (const part of parts) {
    signal.throwIfAborted();
    switch (part.type) {
      case "text":
        content += part.delta;
        break;
      case "tool-start":
        if (pending.has(part.id)) throw new Error(`Duplicate streamed call: ${part.id}`);
        pending.set(part.id, { id: part.id, name: part.name, argumentsText: "" });
        break;
      case "tool-delta": {
        const call = pending.get(part.id);
        if (!call) throw new Error(`Delta without tool-start: ${part.id}`);
        call.argumentsText += part.delta;
        break;
      }
      case "finish": {
        if (part.stopReason === "length" && pending.size > 0) {
          throw new Error("Truncated response: tool arguments must not execute");
        }
        const toolCalls: ToolCall[] = [...pending.values()].map((call) => ({
          id: call.id, name: call.name, arguments: JSON.parse(call.argumentsText) as unknown,
        }));
        if ((part.stopReason === "tool_calls") !== (toolCalls.length > 0)) {
          throw new Error("Finish reason does not match tool calls");
        }
        const response: ModelResponse = {
          message: { role: "assistant", content, toolCalls },
          usage: part.usage, stopReason: part.stopReason,
        };
        await onEvent({ type: "commit", response });
        signal.throwIfAborted();
        return response;
      }
    }
    await onEvent({ type: "preview", text: content, pending: [...pending.values()].map((call) => ({ ...call })) });
  }
  throw new Error("Stream ended without finish");
}
