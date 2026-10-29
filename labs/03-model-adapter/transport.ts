// HTTP scaffolding shared by student and reference message mappings.
import type { Model, ModelRequest, ModelResponse } from "../shared/contracts.ts";

export type OpenAIModelConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
};
export type EncodeRequest = (request: ModelRequest, model: string, maxOutputTokens: number) => Record<string, unknown>;
export type DecodeResponse = (body: unknown) => ModelResponse;

/** Build a non-streaming Responses client with bounded waiting and no automatic retries. */
export function createResponsesTransport(config: OpenAIModelConfig, encode: EncodeRequest, decode: DecodeResponse): Model {
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
    const combined = AbortSignal.any([signal, deadline]);
    try {
      const response = await fetch(endpoint, {
        method: "POST", redirect: "error", signal: combined,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(encode(request, config.model, maxOutputTokens)),
      });
      if (!response.ok) {
        await response.body?.cancel();
        // Provider bodies can echo request details; status is sufficient for this lesson.
        throw new Error(`Model HTTP error ${response.status}; no automatic retry`);
      }
      if (!response.body) throw new Error("Model response has no body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > 1024 * 1024) throw new Error("Model response exceeds 1 MiB");
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
      combined.throwIfAborted();
      const body: unknown = JSON.parse(text);
      return decode(body);
    } catch (error: unknown) {
      signal.throwIfAborted();
      deadline.throwIfAborted();
      throw error;
    }
  };
}
