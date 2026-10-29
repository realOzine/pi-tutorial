// Decode the lesson's explicit SSE event schema, independently of network chunk boundaries.
import type { StreamPart } from "./exercise.ts";

/** Decode UTF-8 SSE data records; this teaching protocol is not a provider-specific API. */
export async function* decodeSse(
  bytes: AsyncIterable<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<StreamPart> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "";
  for await (const chunk of bytes) {
    signal.throwIfAborted();
    buffer += decoder.decode(chunk, { stream: true });
    // A bounded partial frame prevents an untrusted peer from buffering without limit.
    if (buffer.length > 1_048_576) throw new Error("SSE frame exceeds 1 MiB");
    let boundary: RegExpMatchArray | null;
    while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice((boundary.index ?? 0) + boundary[0].length);
      const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, "")).join("\n");
      if (data) yield parsePart(JSON.parse(data) as unknown);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) throw new Error("Incomplete SSE frame at EOF");
}

function parsePart(value: unknown): StreamPart {
  // SSE JSON crosses a network boundary; TypeScript alone cannot validate it.
  if (!value || typeof value !== "object" || !("type" in value)) throw new Error("Invalid stream event");
  if (value.type === "text" && "delta" in value && typeof value.delta === "string") return { type: "text", delta: value.delta };
  if (value.type === "tool-start" && "id" in value && typeof value.id === "string" && value.id && "name" in value && typeof value.name === "string" && value.name) {
    return { type: "tool-start", id: value.id, name: value.name };
  }
  if (value.type === "tool-delta" && "id" in value && typeof value.id === "string" && "delta" in value && typeof value.delta === "string") {
    return { type: "tool-delta", id: value.id, delta: value.delta };
  }
  if (value.type === "finish" && "stopReason" in value && (value.stopReason === "end" || value.stopReason === "tool_calls" || value.stopReason === "length") && "usage" in value) {
    const usage = value.usage;
    if (usage && typeof usage === "object" && "inputTokens" in usage && "outputTokens" in usage &&
      typeof usage.inputTokens === "number" && Number.isSafeInteger(usage.inputTokens) && usage.inputTokens >= 0 &&
      typeof usage.outputTokens === "number" && Number.isSafeInteger(usage.outputTokens) && usage.outputTokens >= 0) {
      return { type: "finish", stopReason: value.stopReason, usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } };
    }
  }
  throw new Error("Invalid stream event fields");
}
