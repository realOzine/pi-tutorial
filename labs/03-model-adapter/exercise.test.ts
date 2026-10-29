// Real local HTTP tests exercise wire mapping without contacting a paid service.
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test, type TestContext } from "node:test";
import * as student from "./exercise.ts";
import * as reference from "../../solutions/03-model-adapter.ts";
import { createMemoryReadTool } from "../02-tool-protocol/fixtures.ts";
import { runMvp } from "./mvp.ts";
import type { ModelRequest } from "../shared/contracts.ts";

const api = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const request: ModelRequest = { systemPrompt: "Use tools", messages: [{ role: "user", content: "read" }],
  tools: [createMemoryReadTool(new Map()).definition] };
const completed = { status: "completed", output: [{ type: "message", role: "assistant",
  content: [{ type: "output_text", text: "done" }] }], usage: { input_tokens: 20, output_tokens: 5 } };
const functionCall = { type: "function_call", id: "item-id-is-not-call-id", call_id: "call-1", name: "read_file", arguments: '{"path":"README.md"}' };

async function fixture(t: TestContext, handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}/v1`;
}

test("mapping preserves tools, failure markers and call IDs; storage and reasoning are explicit", () => {
  const body = api.encodeRequest({ ...request, messages: [...request.messages,
    { role: "assistant", content: "checking", toolCalls: [{ id: "call-1", name: "read_file", arguments: { path: "README.md" } }] },
    { role: "tool", callId: "call-1", content: "missing", isError: true }] }, "gpt-6.1-terra", 128);
  assert.deepEqual(body.input, [
    { role: "user", content: "read" }, { role: "assistant", content: "checking" },
    { type: "function_call", call_id: "call-1", name: "read_file", arguments: '{"path":"README.md"}' },
    { type: "function_call_output", call_id: "call-1", output: '{"isError":true,"content":"missing"}' },
  ]);
  assert.deepEqual(body.reasoning, { effort: "none" });
  assert.equal(body.store, false);
  assert.equal(body.stream, false);
  assert.equal(body.max_output_tokens, 128);
  assert.equal(body.model, "gpt-6.1-terra");
  assert.deepEqual(body.tools, [{ type: "function", ...request.tools[0], strict: false }]);
});

test("response parsing uses call_id and records provider usage", () => {
  const result = api.decodeResponse({ ...completed, output: [functionCall] });
  assert.deepEqual(result.message.toolCalls, [{ id: "call-1", name: "read_file", arguments: { path: "README.md" } }]);
  assert.deepEqual(result.usage, { inputTokens: 20, outputTokens: 5 });
  assert.equal(result.stopReason, "tool_calls");
  assert.equal(api.decodeResponse(completed).stopReason, "end");
});

test("incomplete output remains length even when a partial argument cannot parse", () => {
  const result = api.decodeResponse({ ...completed, status: "incomplete", incomplete_details: { reason: "max_output_tokens" },
    output: [{ ...functionCall, arguments: '{"path":' }] });
  assert.equal(result.stopReason, "length");
  assert.equal(result.message.toolCalls[0].arguments, '{"path":');
});

test("invalid wire data, refusals and unsupported items never become completed", () => {
  for (const body of [null, { ...completed, status: "failed" }, { ...completed, usage: undefined },
    { ...completed, usage: { input_tokens: -1, output_tokens: 0 } },
    { ...completed, output: [{ ...functionCall, arguments: "{" }] },
    { ...completed, output: [functionCall, functionCall] },
    { ...completed, output: [{ type: "reasoning", summary: [] }] },
    { ...completed, output: [{ type: "message", role: "assistant", content: [{ type: "refusal", refusal: "no" }] }] },
    { ...completed, status: "incomplete", incomplete_details: { reason: "content_filter" } },
  ]) assert.throws(() => api.decodeResponse(body));
});

test("the same MVP loop performs two real HTTP requests and returns a linked tool result", async (t) => {
  const received: Record<string, unknown>[] = [];
  const errors: unknown[] = [];
  const baseUrl = await fixture(t, (req, res) => {
    void (async () => {
      assert.equal(req.url, "/v1/responses");
      assert.equal(req.headers.authorization, "Bearer fixture-key");
      let raw = "";
      for await (const chunk of req) raw += String(chunk);
      received.push(JSON.parse(raw) as Record<string, unknown>);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(received.length === 1 ? { ...completed, output: [functionCall] } : completed));
    })().catch((error: unknown) => { errors.push(error); res.statusCode = 500; res.end(); });
  });
  const result = await runMvp({ model: api.createOpenAIModel({ apiKey: "fixture-key", model: "fixture-model", baseUrl }),
    tools: [createMemoryReadTool(new Map([["README.md", "npm run dev"]]))], messages: request.messages,
    systemPrompt: request.systemPrompt, maxSteps: 3, signal: new AbortController().signal });
  assert.deepEqual(errors, []);
  assert.equal(result.status, "completed");
  assert.equal(result.steps, 2);
  assert.deepEqual(result.usage, { inputTokens: 40, outputTokens: 10 });
  assert.equal(received.length, 2);
  assert.match(JSON.stringify(received[1].input), /function_call_output/);
  assert.match(JSON.stringify(received[1].input), /npm run dev/);
});

test("HTTP failure retains status, hides provider body and never retries automatically", async (t) => {
  let calls = 0;
  const baseUrl = await fixture(t, (_req, res) => { calls++; res.statusCode = 429; res.end("private provider error body"); });
  const model = api.createOpenAIModel({ apiKey: "fixture-key", model: "fixture-model", baseUrl });
  await assert.rejects(model(request, new AbortController().signal), (error: unknown) =>
    error instanceof Error && error.message.includes("429") && !error.message.includes("private"));
  assert.equal(calls, 1);
});

test("timeout covers response body reading, while caller cancellation preserves its reason", async (t) => {
  const baseUrl = await fixture(t, (_req, res) => { res.writeHead(200, { "Content-Type": "application/json" }); res.flushHeaders(); });
  const model = api.createOpenAIModel({ apiKey: "fixture-key", model: "fixture-model", baseUrl, timeoutMs: 40 });
  await assert.rejects(model(request, new AbortController().signal), { name: "TimeoutError" });
  const controller = new AbortController();
  const pending = api.createOpenAIModel({ apiKey: "fixture-key", model: "fixture-model", baseUrl })(request, controller.signal);
  setTimeout(() => controller.abort(new Error("user stopped")), 20);
  await assert.rejects(pending, /user stopped/);
});

test("oversized responses and redirects are rejected", async (t) => {
  const largeUrl = await fixture(t, (_req, res) => res.end("x".repeat(1024 * 1024 + 1)));
  await assert.rejects(api.createOpenAIModel({ apiKey: "fixture-key", model: "fixture-model", baseUrl: largeUrl })(request, new AbortController().signal), /exceeds 1 MiB/);
  const redirectUrl = await fixture(t, (_req, res) => { res.writeHead(302, { Location: "https://example.invalid/" }); res.end(); });
  await assert.rejects(api.createOpenAIModel({ apiKey: "fixture-key", model: "fixture-model", baseUrl: redirectUrl })(request, new AbortController().signal));
});

test("a length response cannot execute a side effect through the MVP", async () => {
  let executed = 0;
  const tool = createMemoryReadTool(new Map());
  tool.run = async () => { executed++; return "bad"; };
  const result = await runMvp({ model: async () => api.decodeResponse({ ...completed, output: [functionCall],
    status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }), tools: [tool], messages: request.messages,
    systemPrompt: "", maxSteps: 3, signal: new AbortController().signal });
  assert.equal(result.status, "truncated");
  assert.equal(executed, 0);
  assert.equal(result.steps, 1);
});
