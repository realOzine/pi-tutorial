// Verify streaming state and real incremental HTTP transport without a paid model.
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { consumeStream as student } from "./exercise.ts";
import type { StreamEvent, StreamPart } from "./exercise.ts";
import { consumeStream as reference } from "../../solutions/05-streaming.ts";
import { decodeSse } from "./transport.ts";

const consume = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const finish: StreamPart = { type: "finish", stopReason: "end", usage: { inputTokens: 3, outputTokens: 2 } };

async function* parts(values: StreamPart[]): AsyncGenerator<StreamPart> { yield* values; }

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("text increments produce previews and one complete message", async () => {
  const events: StreamEvent[] = [];
  const result = await consume(parts([{ type: "text", delta: "你" }, { type: "text", delta: "好" }, finish]), new AbortController().signal, (event) => { events.push(event); });
  assert.equal(result.message.content, "你好");
  assert.deepEqual(events.map((event) => event.type), ["preview", "preview", "commit"]);
  assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 2 });
});

test("tool arguments remain raw in preview and parse only at finish", async () => {
  const events: StreamEvent[] = [];
  const result = await consume(parts([
    { type: "tool-start", id: "r1", name: "read" },
    { type: "tool-delta", id: "r1", delta: '{"path":' },
    { type: "tool-delta", id: "r1", delta: '"README.md"}' },
    { ...finish, stopReason: "tool_calls" },
  ]), new AbortController().signal, (event) => { events.push(event); });
  assert.equal(events[1].type === "preview" && events[1].pending[0].argumentsText, '{"path":');
  assert.deepEqual(result.message.toolCalls[0].arguments, { path: "README.md" });
  assert.equal(events.filter((event) => event.type === "commit").length, 1);
});

test("truncation and unfinished streams never commit", async () => {
  for (const values of [
    [{ type: "text", delta: "unfinished" }] as StreamPart[],
    [{ type: "tool-start", id: "r", name: "write" }, { type: "tool-delta", id: "r", delta: "{}" }, { ...finish, stopReason: "length" }] as StreamPart[],
  ]) {
    let commits = 0;
    await assert.rejects(consume(parts(values), new AbortController().signal, (event) => { if (event.type === "commit") commits++; }), /without finish|Truncated/);
    assert.equal(commits, 0);
  }
});

test("awaited listener prevents consumption of the next increment", async () => {
  const gate = deferred();
  const entered = deferred();
  let pulled = 0;
  async function* source(): AsyncGenerator<StreamPart> { pulled++; yield { type: "text", delta: "a" }; pulled++; yield finish; }
  const running = consume(source(), new AbortController().signal, async (event) => {
    if (event.type === "preview") { entered.resolve(); await gate.promise; }
  });
  // Observe a rejection too, so the student TODO fails rather than waiting forever.
  await Promise.race([entered.promise, running]);
  assert.equal(pulled, 1);
  gate.resolve();
  await running;
  assert.equal(pulled, 2);
});

test("listener error and abort reject, generator cleanup runs", async () => {
  let cleaned = false;
  async function* source(): AsyncGenerator<StreamPart> { try { yield { type: "text", delta: "a" }; yield finish; } finally { cleaned = true; } }
  await assert.rejects(consume(source(), new AbortController().signal, () => { throw new Error("UI failed"); }), /UI failed/);
  assert.equal(cleaned, true);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(consume(parts([finish]), controller.signal), { name: "AbortError" });
});

test("HTTP SSE bytes arrive before final response, including split UTF-8", async () => {
  const gate = deferred();
  const sawPreview = deferred();
  const server = createServer(async (_request, response) => {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const first = Buffer.from('data: {"type":"text","delta":"你好"}\n\n');
    const split = first.indexOf(Buffer.from("你")) + 1;
    response.write(first.subarray(0, split));
    response.write(first.subarray(split));
    await gate.promise;
    response.end(`data: ${JSON.stringify(finish)}\r\n\r\n`);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}`);
    assert(response.body);
    const running = consume(decodeSse(response.body, new AbortController().signal), new AbortController().signal, (event) => {
      if (event.type === "preview") { assert.equal(event.text, "你好"); sawPreview.resolve(); }
    });
    await Promise.race([sawPreview.promise, running]);
    gate.resolve();
    assert.equal((await running).message.content, "你好");
  } finally {
    gate.resolve();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("wire decoder rejects invalid events and unfinished frames", async () => {
  async function* bytes(value: string): AsyncGenerator<Uint8Array> { yield Buffer.from(value); }
  for (const input of ['data: {"type":"text","delta":7}\n\n', 'data: {"type":"text"}']) {
    await assert.rejects(async () => { for await (const _part of decodeSse(bytes(input), new AbortController().signal)) { /* Consume to validate. */ } }, /Invalid|Incomplete/);
  }
});

test("invalid call ordering, JSON and finish reason do not commit", async () => {
  const cases: { values: StreamPart[]; error: RegExp }[] = [
    { values: [{ type: "tool-start", id: "r", name: "read" }, { type: "tool-start", id: "r", name: "read" }], error: /Duplicate/ },
    { values: [{ type: "tool-delta", id: "missing", delta: "{}" }], error: /without tool-start/ },
    { values: [{ type: "tool-start", id: "r", name: "read" }, { type: "tool-delta", id: "r", delta: "{" }, { ...finish, stopReason: "tool_calls" }], error: /JSON|property/ },
    { values: [{ ...finish, stopReason: "tool_calls" }], error: /does not match/ },
    { values: [{ type: "tool-start", id: "r", name: "read" }, { type: "tool-delta", id: "r", delta: "{}" }, finish], error: /does not match/ },
  ];
  for (const scenario of cases) {
    let commits = 0;
    await assert.rejects(consume(parts(scenario.values), new AbortController().signal, (event) => { if (event.type === "commit") commits++; }), scenario.error);
    assert.equal(commits, 0);
  }
});

test("mid-stream abort emits no later preview or commit and closes generator", async () => {
  const controller = new AbortController();
  const events: StreamEvent[] = [];
  let cleaned = false;
  async function* source(): AsyncGenerator<StreamPart> {
    try { yield { type: "text", delta: "a" }; yield { type: "text", delta: "b" }; yield finish; }
    finally { cleaned = true; }
  }
  await assert.rejects(consume(source(), controller.signal, (event) => { events.push(event); controller.abort(); }), { name: "AbortError" });
  assert.equal(cleaned, true);
  assert.deepEqual(events.map((event) => event.type), ["preview"]);
});
