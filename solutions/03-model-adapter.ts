// A deliberately small OpenAI Responses adapter: text and function tools, reasoning effort none.
import type { Model, ModelRequest, ModelResponse, ToolCall } from "../labs/shared/contracts.ts";
import { createResponsesTransport, type OpenAIModelConfig } from "../labs/03-model-adapter/transport.ts";

/** Create the real HTTP model; callers choose when a paid request is allowed. */
export function createOpenAIModel(config: OpenAIModelConfig): Model {
  return createResponsesTransport(config, encodeRequest, decodeResponse);
}

/** Preserve function calls and results as separate Responses items linked by call_id. */
export function encodeRequest(request: ModelRequest, model: string, maxOutputTokens: number): Record<string, unknown> {
  const input: Record<string, unknown>[] = [];
  for (const message of request.messages) {
    if (message.role === "user") input.push({ role: "user", content: message.content });
    else if (message.role === "tool") input.push({ type: "function_call_output", call_id: message.callId,
      output: JSON.stringify({ isError: message.isError, content: message.content }) });
    else {
      if (message.content) input.push({ role: "assistant", content: message.content });
      for (const call of message.toolCalls) input.push({ type: "function_call", call_id: call.id,
        name: call.name, arguments: JSON.stringify(call.arguments) });
    }
  }
  return { model, instructions: request.systemPrompt, input,
    tools: request.tools.map((tool) => ({ type: "function", ...tool, strict: false })),
    reasoning: { effort: "none" }, store: false, stream: false, max_output_tokens: maxOutputTokens };
}

/** Reject malformed wire input rather than silently discarding calls or reporting false success. */
export function decodeResponse(value: unknown): ModelResponse {
  const body = record(value, "response");
  if (body.status !== "completed" && body.status !== "incomplete") throw new Error("Model response did not complete");
  const truncated = body.status === "incomplete";
  if (truncated && record(body.incomplete_details, "incomplete_details").reason !== "max_output_tokens") {
    throw new Error("Model response incomplete for a reason other than output budget");
  }
  if (!Array.isArray(body.output)) throw new Error("Invalid response.output");
  const calls: ToolCall[] = [];
  const text: string[] = [];
  for (const rawItem of body.output) {
    const item = record(rawItem, "output item");
    if (item.type === "message") {
      if (item.role !== "assistant" || !Array.isArray(item.content)) throw new Error("Invalid assistant message");
      for (const rawPart of item.content) {
        const part = record(rawPart, "content part");
        if (part.type === "refusal") throw new Error("Model refused the request");
        if (part.type !== "output_text" || typeof part.text !== "string") throw new Error("Unsupported content part");
        text.push(part.text);
      }
    } else if (item.type === "function_call") {
      if (typeof item.call_id !== "string" || !item.call_id || typeof item.name !== "string" || !item.name || typeof item.arguments !== "string") {
        throw new Error("Invalid function call");
      }
      let arguments_: unknown;
      try { arguments_ = JSON.parse(item.arguments); }
      catch {
        if (!truncated) throw new Error("Function arguments are not valid JSON");
        // Keep the raw partial input only as evidence; length responses never execute tools.
        arguments_ = item.arguments;
      }
      calls.push({ id: item.call_id, name: item.name, arguments: arguments_ });
    } else {
      throw new Error(`Unsupported output item: ${String(item.type)}; this lesson supports text and function calls with reasoning effort none`);
    }
  }
  if (new Set(calls.map((call) => call.id)).size !== calls.length) throw new Error("Duplicate response call IDs");
  const usage = record(body.usage, "usage");
  if (!Number.isSafeInteger(usage.input_tokens) || typeof usage.input_tokens !== "number" || usage.input_tokens < 0 ||
      !Number.isSafeInteger(usage.output_tokens) || typeof usage.output_tokens !== "number" || usage.output_tokens < 0) throw new Error("Invalid response usage");
  if (!truncated && text.length === 0 && calls.length === 0) throw new Error("Completed response has no supported output");
  return { message: { role: "assistant", content: text.join("\n"), toolCalls: calls },
    usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
    stopReason: truncated ? "length" : calls.length > 0 ? "tool_calls" : "end" };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}
