// Map actual OpenAI Responses SSE events onto the lesson's incremental consumer.
import { isDeepStrictEqual } from "node:util";
import { encodeRequest, decodeResponse } from "../../solutions/03-model-adapter.ts";
import { consumeStream } from "../../solutions/05-streaming.ts";
import type { OpenAIModelConfig } from "../03-model-adapter/transport.ts";
import type { Model, ToolCall } from "../shared/contracts.ts";
import type { StreamListener, StreamPart } from "./exercise.ts";
import { decodeSseData } from "./transport.ts";

type PendingCall = { id: string; name: string; argumentsText: string };

/** Create a real streaming model with explicit output/timeout bounds and no automatic retry. */
export function createStreamingOpenAIModel(config: OpenAIModelConfig, onEvent?: StreamListener): Model {
  if (!config.apiKey.trim() || !config.model.trim()) throw new Error("API key and model are required");
  const endpoint = new URL(`${(config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")}/responses`);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("Invalid provider base URL");
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && loopback)) throw new Error("Provider requires HTTPS; HTTP is only allowed for loopback fixtures");
  const timeoutMs = config.timeoutMs ?? 30_000;
  const maxOutputTokens = config.maxOutputTokens ?? 512;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw new Error("Invalid timeoutMs");
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 16) throw new Error("maxOutputTokens must be an integer of at least 16");
  return async (request, signal) => {
    signal.throwIfAborted();
    const deadline = AbortSignal.timeout(timeoutMs);
    const cleanup = new AbortController();
    const combined = AbortSignal.any([signal, deadline, cleanup.signal]);
    try {
      const response = await fetch(endpoint, {
        method: "POST", redirect: "error", signal: combined,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ ...encodeRequest(request, config.model, maxOutputTokens), stream: true }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Model HTTP error ${response.status}; no automatic retry`);
      }
      if (!response.body) throw new Error("Model response has no body");
      return await consumeStream(mapResponsesEvents(decodeSseData(response.body, combined)), combined, onEvent);
    } catch (error) {
      signal.throwIfAborted();
      deadline.throwIfAborted();
      throw error;
    } finally {
      // An observer or decoder failure must also terminate the underlying HTTP request.
      cleanup.abort();
    }
  };
}

async function* mapResponsesEvents(events: AsyncIterable<unknown>): AsyncGenerator<StreamPart> {
  const calls = new Map<string, PendingCall>();
  const messageIds = new Set<string>();
  const textParts = new Map<string, string>();
  let activeTextPart: string | undefined;
  for await (const raw of events) {
    const event = record(raw, "stream event");
    if (typeof event.type !== "string") throw new Error("Invalid stream event type");
    switch (event.type) {
      case "response.output_item.added": {
        const item = record(event.item, "output item");
        const itemId = string(item.id, "item.id");
        if (calls.has(itemId) || messageIds.has(itemId)) throw new Error("Duplicate stream item ID");
        if (item.type === "function_call") {
          const call = { id: string(item.call_id, "call_id"), name: string(item.name, "name"), argumentsText: string(item.arguments, "arguments", true) };
          calls.set(itemId, call);
          yield { type: "tool-start", id: call.id, name: call.name };
          if (call.argumentsText) yield { type: "tool-delta", id: call.id, delta: call.argumentsText };
        } else if (item.type === "message" && item.role === "assistant") messageIds.add(itemId);
        else throw new Error("Unsupported streaming output item; this lesson uses text and function calls with reasoning none");
        break;
      }
      case "response.output_text.delta": {
        const itemId = string(event.item_id, "item_id");
        if (!messageIds.has(itemId)) throw new Error("Text delta has no assistant item");
        if (!Number.isSafeInteger(event.content_index) || typeof event.content_index !== "number" || event.content_index < 0) throw new Error("Invalid content_index");
        const key = `${itemId}:${event.content_index}`;
        const delta = string(event.delta, "delta", true);
        if (activeTextPart !== key) {
          if (textParts.has(key)) throw new Error("Interleaved text parts are outside this lesson's adapter");
          if (textParts.size > 0) yield { type: "text", delta: "\n" };
          activeTextPart = key;
        }
        textParts.set(key, (textParts.get(key) ?? "") + delta);
        yield { type: "text", delta };
        break;
      }
      case "response.function_call_arguments.delta": {
        const call = calls.get(string(event.item_id, "item_id"));
        if (!call) throw new Error("Arguments delta has no function item");
        const delta = string(event.delta, "delta", true);
        call.argumentsText += delta;
        yield { type: "tool-delta", id: call.id, delta };
        break;
      }
      case "response.function_call_arguments.done": {
        const call = calls.get(string(event.item_id, "item_id"));
        if (!call || call.argumentsText !== event.arguments) throw new Error("Final arguments differ from streamed arguments");
        break;
      }
      case "response.completed":
      case "response.incomplete": {
        const body = record(event.response, "final response");
        if ((event.type === "response.completed" ? "completed" : "incomplete") !== body.status) throw new Error("Final event and response status disagree");
        const final = decodeResponse(body);
        const toolCalls: ToolCall[] = [...calls.values()].map((call) => {
          let arguments_: unknown;
          try { arguments_ = JSON.parse(call.argumentsText) as unknown; }
          catch { if (final.stopReason !== "length") throw new Error("Invalid streamed tool JSON"); arguments_ = call.argumentsText; }
          return { id: call.id, name: call.name, arguments: arguments_ };
        });
        if (!isDeepStrictEqual(toolCalls, final.message.toolCalls) || [...textParts.values()].join("\n") !== final.message.content) {
          throw new Error("Final response differs from streamed preview");
        }
        yield { type: "finish", stopReason: final.stopReason, usage: final.usage };
        return;
      }
      case "error":
      case "response.failed":
        throw new Error("Provider streaming response failed; no automatic retry");
      case "response.refusal.delta":
      case "response.refusal.done":
        throw new Error("Model refused the request");
      case "response.created":
      case "response.in_progress":
      case "response.queued":
      case "response.content_part.added":
      case "response.content_part.done":
      case "response.output_item.done":
      case "response.output_text.done":
      case "response.output_text.annotation.added":
        break;
      default:
        throw new Error(`Unsupported streaming event: ${event.type}`);
    }
  }
  throw new Error("Responses stream ended before completed/incomplete");
}

function record(value: unknown, label: string): Record<string, unknown> {
  // Provider JSON is untrusted wire input; only object records may be inspected below.
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value)) throw new Error(`Invalid ${label}`);
  return value;
}
