// Prove scheduling order with gates, not brittle elapsed-time thresholds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { executeBatch as student } from "./exercise.ts";
import { executeBatch as reference } from "../../solutions/07-scheduling.ts";
import type { Tool, ToolCall, ToolMessage } from "../shared/contracts.ts";

const executeBatch = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const calls: ToolCall[] = [{ id: "a", name: "read", arguments: "A" }, { id: "b", name: "read", arguments: "B" }];
const tool: Tool = { definition: { name: "read", description: "fixture", parameters: {} }, execution: "parallel", validate: () => {}, run: async () => "unused" };
const result = (call: ToolCall): ToolMessage => ({ role: "tool", callId: call.id, content: String(call.arguments), isError: false });
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("parallel starts overlap, completion order differs from returned call order", { timeout: 2000 }, async () => {
  const a = deferred(); const both = deferred(); const bDone = deferred();
  const started: string[] = []; const completed: string[] = [];
  const running = executeBatch(calls, [tool], new AbortController().signal, {
    execute: async (call) => { started.push(call.id); if (started.length === 2) both.resolve(); if (call.id === "a") await a.promise; return result(call); },
    onResult: (value) => { completed.push(value.callId); if (value.callId === "b") bDone.resolve(); },
  });
  await Promise.race([both.promise, running]);
  await Promise.race([bDone.promise, running]);
  assert.deepEqual(started, ["a", "b"]); assert.deepEqual(completed, ["b"]);
  a.resolve();
  assert.deepEqual((await running).map((value) => value.callId), ["a", "b"]);
  assert.deepEqual(completed, ["b", "a"]);
});

test("one sequential tool makes the whole batch sequential", async () => {
  const trace: string[] = [];
  const write = { ...tool, definition: { ...tool.definition, name: "write" }, execution: "sequential" as const };
  await executeBatch([calls[0], { ...calls[1], name: "write" }], [tool, write], new AbortController().signal, {
    execute: async (call) => { trace.push(`start:${call.id}`); await Promise.resolve(); trace.push(`end:${call.id}`); return result(call); },
  });
  assert.deepEqual(trace, ["start:a", "end:a", "start:b", "end:b"]);
});

test("every preflight finishes before any allowed execution; bad calls do not execute", async () => {
  const trace: string[] = [];
  const checked = { ...tool, validate: (value: unknown) => { trace.push(`check:${String(value)}`); if (value === "B") throw new Error("bad B"); } };
  const values = await executeBatch([...calls, { id: "c", name: "missing", arguments: {} }], [checked], new AbortController().signal, {
    execute: async (call) => { trace.push(`run:${call.id}`); return result(call); },
  });
  assert.deepEqual(trace, ["check:A", "check:B", "run:a"]);
  assert.deepEqual(values.map((value) => value.isError), [false, true, true]);
});

test("tool exception preserves another successful result", async () => {
  const values = await executeBatch(calls, [tool], new AbortController().signal, {
    execute: async (call) => { if (call.id === "a") throw new Error("A failed"); return result(call); },
  });
  assert.equal(values[0].isError, true); assert.equal(values[0].content, "A failed");
  assert.equal(values[1].isError, false);
});

test("pre-abort starts nothing and cancelled sequential remainder stays associated", async () => {
  const before = new AbortController(); before.abort();
  let starts = 0;
  const skipped = await executeBatch(calls, [tool], before.signal, { execute: async (call) => { starts++; return result(call); } });
  assert.equal(starts, 0); assert(skipped.every((value) => value.isError));
  const during = new AbortController();
  const values = await executeBatch(calls, [{ ...tool, execution: "sequential" }], during.signal, {
    execute: async (call, _tools, signal) => { assert.equal(signal, during.signal); starts++; during.abort(); return result(call); },
  });
  assert.equal(starts, 1); assert.deepEqual(values.map((value) => [value.callId, value.isError]), [["a", false], ["b", true]]);
});

test("observer failure waits for other started tools to settle", { timeout: 2000 }, async () => {
  const b = deferred(); const sawA = deferred();
  let bFinished = false; let returned = false;
  const running = executeBatch(calls, [tool], new AbortController().signal, {
    execute: async (call) => { if (call.id === "b") { await b.promise; bFinished = true; } return result(call); },
    onResult: (value) => { if (value.callId === "a") { sawA.resolve(); throw new Error("observer failed"); } },
  });
  const observed = running.then(() => { returned = true; }, (error: unknown) => { returned = true; throw error; });
  const rejection = assert.rejects(observed, /observer failed/);
  await Promise.race([sawA.promise, rejection]);
  assert.equal(returned, false); assert.equal(bFinished, false);
  b.resolve(); await rejection;
  assert.equal(bFinished, true);
});

test("parallel abort reaches all started calls and waits for their cleanup", async () => {
  const controller = new AbortController();
  let started = 0; let cleaned = 0;
  const values = await executeBatch(calls, [tool], controller.signal, {
    execute: async (_call, _tools, signal) => {
      started++;
      const cancelled = new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      if (started === 2) controller.abort();
      await cancelled; cleaned++; signal.throwIfAborted(); throw new Error("unreachable");
    },
  });
  assert.equal(started, 2); assert.equal(cleaned, 2); assert(values.every((value) => value.isError));
});

test("duplicate IDs reject before side effects and empty batch returns empty", async () => {
  let started = false;
  await assert.rejects(executeBatch([calls[0], calls[0]], [tool], new AbortController().signal, { execute: async (call) => { started = true; return result(call); } }), /Duplicate/);
  assert.equal(started, false);
  assert.deepEqual(await executeBatch([], [tool], new AbortController().signal, { execute: async (call) => result(call) }), []);
});
