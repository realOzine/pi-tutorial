// Exercise queue boundaries and observable cancellation without clocks or paid models.
import assert from "node:assert/strict";
import { test } from "node:test";
import { InputQueue as StudentQueue, runControlled as student } from "./exercise.ts";
import type { ControlledOptions } from "./exercise.ts";
import { InputQueue as ReferenceQueue, runControlled as reference } from "../../solutions/06-cancellation.ts";
import type { ModelResponse, ToolCall } from "../shared/contracts.ts";

const run = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const Queue = process.env.PI_TUTORIAL_REFERENCE === "1" ? ReferenceQueue : StudentQueue;
const call: ToolCall = { id: "r1", name: "read", arguments: {} };
const answer = (toolCalls: ToolCall[] = []): ModelResponse => ({ message: { role: "assistant", content: toolCalls.length ? "working" : "done", toolCalls }, stopReason: toolCalls.length ? "tool_calls" : "end", usage: { inputTokens: 1, outputTokens: 1 } });
function options(overrides: Partial<ControlledOptions> = {}): ControlledOptions {
  return { initialMessages: [{ role: "user", content: "task" }], model: async () => answer(), tools: [], systemPrompt: "", execute: async (value) => ({ role: "tool", callId: value.id, content: "ok", isError: false }), queue: new Queue(), signal: new AbortController().signal, maxSteps: 5, ...overrides };
}

test("queue prioritizes one steering item; follow-up waits until idle", () => {
  const queue = new Queue();
  queue.followUp("later"); queue.steer("first"); queue.steer("second");
  assert.deepEqual(queue.drain("turn"), [{ role: "user", content: "first" }]);
  assert.deepEqual(queue.drain("idle"), [{ role: "user", content: "second" }]);
  assert.deepEqual(queue.drain("turn"), []);
  assert.deepEqual(queue.drain("idle"), [{ role: "user", content: "later" }]);
  assert.deepEqual(queue.drain("idle"), []);
});

test("steering during tools enters next request; follow-up waits for final answer", async () => {
  const queue = new Queue();
  const requests: string[][] = [];
  const result = await run(options({ queue,
    model: async (request) => { requests.push(request.messages.map((message) => message.content)); return answer(requests.length === 1 ? [call] : []); },
    execute: async (value) => { queue.followUp("summarize later"); queue.steer("use Chinese"); return { role: "tool", callId: value.id, content: "README", isError: false }; },
  }));
  assert.equal(result.status, "completed");
  assert.equal(requests.length, 3);
  assert.deepEqual(requests[1].slice(-2), ["README", "use Chinese"]);
  assert(!requests[1].includes("summarize later"));
  assert.equal(requests[2].at(-1), "summarize later");
});

test("pre-abort starts neither model nor tool", async () => {
  const controller = new AbortController(); controller.abort();
  let started = 0;
  const result = await run(options({ signal: controller.signal, model: async () => { started++; return answer(); } }));
  assert.equal(result.status, "cancelled"); assert.equal(started, 0); assert.equal(result.steps, 0);
});

test("model receives the same signal and cancellation is not a successful answer", async () => {
  const controller = new AbortController();
  const result = await run(options({ signal: controller.signal,
    model: async (_request, signal) => { assert.equal(signal, controller.signal); controller.abort(); signal.throwIfAborted(); return answer(); },
  }));
  assert.equal(result.status, "cancelled"); assert.equal(result.messages.length, 1); assert.equal(result.steps, 1);
});

test("cancelled batch records prior side effect and does not start remaining tool", async () => {
  const controller = new AbortController();
  let writes = 0;
  const result = await run(options({ signal: controller.signal, model: async () => answer([call, { ...call, id: "r2" }]),
    execute: async (value, signal) => { assert.equal(signal, controller.signal); writes++; controller.abort(); return { role: "tool", callId: value.id, content: "written", isError: false }; },
  }));
  assert.equal(writes, 1); assert.equal(result.status, "cancelled");
  assert.deepEqual(result.messages.slice(-2).map((message) => message.role === "tool" && [message.callId, message.isError]), [["r1", false], ["r2", true]]);
});

test("tool failures remain feedback; model failures propagate", async () => {
  let count = 0;
  const result = await run(options({ model: async () => answer(++count === 1 ? [call] : []), execute: async () => { throw new Error("missing file"); } }));
  assert.equal(result.status, "completed");
  assert(result.messages.some((message) => message.role === "tool" && message.isError && message.content === "missing file"));
  await assert.rejects(run(options({ model: async () => { throw new Error("provider failed"); } })), /provider failed/);
});

test("truncated calls do not execute; budget bounds queued continuations", async () => {
  let executions = 0;
  const result = await run(options({ model: async () => ({ ...answer([call]), stopReason: "length" }), execute: async () => { executions++; throw new Error("must not run"); } }));
  assert.equal(result.status, "truncated"); assert.equal(executions, 0);
  const queue = new Queue(); queue.followUp("next");
  const bounded = await run(options({ queue, maxSteps: 1 }));
  assert.equal(bounded.status, "budget"); assert.equal(bounded.steps, 1);
  assert.equal(bounded.messages.at(-1)?.content, "next");
});
