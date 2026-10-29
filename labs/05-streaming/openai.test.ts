// Verify the real Responses SSE mapping against local HTTP fixtures only.
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { test } from "node:test";
import { createStreamingOpenAIModel } from "./openai.ts";
import type { ModelRequest } from "../shared/contracts.ts";

const request: ModelRequest = { systemPrompt: "fixture", messages: [{ role: "user", content: "Read README" }], tools: [] };
const textItem = { id: "msg1", type: "message", role: "assistant", content: [{ type: "output_text", text: "你好" }] };
const finalBody = (output: unknown[], status = "completed") => ({ status, output, usage: { input_tokens: 7, output_tokens: 3 }, ...(status === "incomplete" ? { incomplete_details: { reason: "max_output_tokens" } } : {}) });
const textEvents = [
  { type: "response.output_item.added", item: { ...textItem, content: [] }, output_index: 0 },
  { type: "response.output_text.delta", item_id: "msg1", content_index: 0, delta: "你" },
  { type: "response.output_text.delta", item_id: "msg1", content_index: 0, delta: "好" },
];
function writeEvents(response: ServerResponse, events: unknown[]): void {
  for (const event of events) response.write(`event: ignored\ndata: ${JSON.stringify(event)}\n\n`);
}
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
async function withServer(handler: (request: IncomingMessage, response: ServerResponse) => void, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test("Responses text previews arrive before completed and requests retain explicit bounds", { timeout: 2000 }, async () => {
  const preview = deferred(); const releaseFinal = deferred();
  let body = ""; let pathname = "";
  await withServer((req, response) => {
    pathname = req.url ?? "";
    req.setEncoding("utf8"); req.on("data", (chunk: string) => { body += chunk; });
    req.on("end", () => {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      writeEvents(response, textEvents);
      void releaseFinal.promise.then(() => { writeEvents(response, [{ type: "response.completed", response: finalBody([textItem]) }]); response.end(); });
    });
  }, async (baseUrl) => {
    const model = createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture-model", baseUrl, maxOutputTokens: 128 }, (event) => { if (event.type === "preview" && event.text === "你好") preview.resolve(); });
    const running = model(request, new AbortController().signal);
    try {
      await Promise.race([preview.promise, running]);
      const encoded = JSON.parse(body) as Record<string, unknown>;
      assert.equal(pathname, "/responses"); assert.equal(encoded.stream, true); assert.equal(encoded.store, false);
      assert.equal(encoded.model, "fixture-model"); assert.equal(encoded.max_output_tokens, 128);
      assert.deepEqual(encoded.reasoning, { effort: "none" });
      releaseFinal.resolve();
      const value = await running;
      assert.equal(value.message.content, "你好"); assert.equal(value.stopReason, "end");
      assert.deepEqual(value.usage, { inputTokens: 7, outputTokens: 3 });
    } finally { releaseFinal.resolve(); }
  });
});

test("function delta item_id maps to call_id and only response completion commits", async () => {
  const call = { id: "fc-item", call_id: "call-result", type: "function_call", name: "read", arguments: '{"path":"README.md"}' };
  const events = [
    { type: "response.output_item.added", item: { ...call, arguments: "" } },
    { type: "response.function_call_arguments.delta", item_id: "fc-item", delta: '{"path":' },
    { type: "response.function_call_arguments.delta", item_id: "fc-item", delta: '"README.md"}' },
    { type: "response.function_call_arguments.done", item_id: "fc-item", arguments: call.arguments },
    { type: "response.completed", response: finalBody([call]) },
  ];
  await withServer((_req, response) => { writeEvents(response, events); response.end(); }, async (baseUrl) => {
    let commits = 0;
    const model = createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl }, (event) => { if (event.type === "commit") commits++; });
    const value = await model(request, new AbortController().signal);
    assert.deepEqual(value.message.toolCalls, [{ id: "call-result", name: "read", arguments: { path: "README.md" } }]);
    assert.equal(commits, 1);
  });
});

test("stream EOF, snapshot disagreement, provider failure, refusal and unknown IDs reject", async () => {
  const scenarios = [
    { events: textEvents, error: /ended before/ },
    { events: [...textEvents, { type: "response.completed", response: finalBody([{ ...textItem, content: [{ type: "output_text", text: "different" }] }]) }], error: /differs/ },
    { events: [{ type: "response.failed", response: {} }], error: /failed/ },
    { events: [{ type: "response.refusal.delta", delta: "no" }], error: /refused/ },
    { events: [{ type: "response.function_call_arguments.delta", item_id: "missing", delta: "{}" }], error: /no function item/ },
  ];
  for (const scenario of scenarios) {
    await withServer((_req, response) => { writeEvents(response, scenario.events); response.end(); }, async (baseUrl) => {
      let commits = 0;
      const model = createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl }, (event) => { if (event.type === "commit") commits++; });
      await assert.rejects(model(request, new AbortController().signal), scenario.error);
      assert.equal(commits, 0);
    });
  }
});

test("incomplete tool output rejects even when argument JSON is syntactically valid", async () => {
  const call = { id: "fc", call_id: "call", type: "function_call", name: "write", arguments: "{}" };
  await withServer((_req, response) => {
    writeEvents(response, [{ type: "response.output_item.added", item: call }, { type: "response.incomplete", response: finalBody([call], "incomplete") }]); response.end();
  }, async (baseUrl) => {
    const model = createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl });
    await assert.rejects(model(request, new AbortController().signal), /Truncated/);
  });
});

test("abort during HTTP body reading terminates the request without a commit", async () => {
  await withServer((_req, response) => { writeEvents(response, textEvents); }, async (baseUrl) => {
    const controller = new AbortController(); let commits = 0;
    const model = createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl }, (event) => {
      if (event.type === "preview") controller.abort(); else commits++;
    });
    await assert.rejects(model(request, controller.signal), { name: "AbortError" });
    assert.equal(commits, 0);
  });
});

test("HTTP timeout, oversized body and status failure remain explicit", async () => {
  await withServer((_req, response) => { response.writeHead(200); response.flushHeaders(); }, async (baseUrl) => {
    const model = createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl, timeoutMs: 30 });
    await assert.rejects(model(request, new AbortController().signal), { name: "TimeoutError" });
  });
  await withServer((_req, response) => { response.end("x".repeat(1_048_577)); }, async (baseUrl) => {
    await assert.rejects(createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl })(request, new AbortController().signal), /exceeds 1 MiB/);
  });
  await withServer((_req, response) => { response.writeHead(429); response.end("private provider details"); }, async (baseUrl) => {
    await assert.rejects(createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl })(request, new AbortController().signal), /HTTP error 429; no automatic retry/);
  });
});

test("provider configuration rejects unsafe transport or invalid limits before requests", () => {
  assert.throws(() => createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", baseUrl: "http://example.com" }), /HTTPS/);
  assert.throws(() => createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", maxOutputTokens: 0 }), /maxOutputTokens/);
  assert.throws(() => createStreamingOpenAIModel({ apiKey: "fixture-key", model: "fixture", timeoutMs: 0 }), /timeoutMs/);
});
