// Protocol tests run against student functions by default and reference functions explicitly.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as student from "./exercise.ts";
import * as reference from "../../solutions/02-tool-protocol.ts";
import { createMemoryReadTool } from "./fixtures.ts";
import type { ModelResponse, Tool } from "../shared/contracts.ts";

const api = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const signal = new AbortController().signal;
const call = { id: "read-1", name: "read_file", arguments: { path: "README.md" } };
const tools = [createMemoryReadTool(new Map([["README.md", "npm run dev"]]))];

test("success preserves the original call ID", async () => {
  assert.deepEqual(await api.executeToolCall(call, tools, signal), { role: "tool", callId: "read-1", content: "npm run dev", isError: false });
});

test("unknown tools, invalid arguments and execution failures become distinct feedback", async () => {
  for (const [input, pattern] of [
    [{ ...call, name: "delete_everything" }, /Unknown tool/],
    [{ ...call, arguments: { path: [] } }, /Expected exactly/],
    [{ ...call, arguments: { path: "missing" } }, /File not found/],
  ] as const) {
    const result = await api.executeToolCall(input, tools, signal);
    assert.equal(result.isError, true);
    assert.equal(result.callId, call.id);
    assert.match(result.content, pattern);
  }
});

test("schema failure cannot reach a side effect", async () => {
  let executed = 0;
  const tool: Tool = { ...tools[0], run: async () => { executed++; return "bad"; } };
  const result = await api.executeToolCall({ ...call, arguments: { path: ["README.md"] } }, [tool], signal);
  assert.equal(result.isError, true);
  assert.equal(executed, 0);
});

test("duplicate registrations do not select an arbitrary implementation", async () => {
  const result = await api.executeToolCall(call, [tools[0], tools[0]], signal);
  assert.equal(result.isError, true);
  assert.match(result.content, /Ambiguous/);
});

test("unknown thrown values are still error feedback", async () => {
  const result = await api.executeToolCall(call, [{ ...tools[0], run: async () => { throw "offline"; } }], signal);
  assert.equal(result.isError, true);
  assert.equal(result.content, "offline");
});

test("a truncated response executes nothing even when arguments are valid", async () => {
  let executed = 0;
  const response: ModelResponse = { message: { role: "assistant", content: "", toolCalls: [call] },
    usage: { inputTokens: 12, outputTokens: 3 }, stopReason: "length" };
  const results = await api.executeResponseTools(response, [{ ...tools[0], run: async () => { executed++; return "bad"; } }], signal);
  assert.equal(executed, 0);
  assert.equal(results[0].isError, true);
  assert.equal(results[0].callId, call.id);
  assert.match(results[0].content, /truncated/);
});

test("normal batches preserve call order and duplicate IDs are rejected", async () => {
  const response: ModelResponse = { message: { role: "assistant", content: "", toolCalls: [call, { ...call, id: "read-2" }] },
    usage: { inputTokens: 0, outputTokens: 0 }, stopReason: "tool_calls" };
  assert.deepEqual((await api.executeResponseTools(response, tools, signal)).map((result) => result.callId), ["read-1", "read-2"]);
  response.message.toolCalls[1].id = "read-1";
  await assert.rejects(api.executeResponseTools(response, tools, signal), /Duplicate/);
});

test("cancellation propagates before and during a call instead of becoming retry feedback", async () => {
  const controller = new AbortController();
  controller.abort(new Error("user stopped"));
  await assert.rejects(api.executeToolCall(call, tools, controller.signal), /user stopped/);
  const active = new AbortController();
  const tool: Tool = { ...tools[0], run: async (_args, received) => {
    assert.equal(received, active.signal);
    active.abort(new Error("stopped while running"));
    throw new Error("tool failed too");
  } };
  await assert.rejects(api.executeToolCall(call, [tool], active.signal), /stopped while running/);
});
