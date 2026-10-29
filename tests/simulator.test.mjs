import assert from "node:assert/strict";
import test from "node:test";
import { createDemoTrace, getStep, MAX_TRACE_BYTES, parseTrace, SCENARIOS } from "../site/assets/simulator.mjs";

test("all teaching scenarios preserve a valid history and reach stop", () => {
  for (const scenario of Object.keys(SCENARIOS)) {
    const trace = parseTrace(JSON.stringify(createDemoTrace(scenario)));
    assert.equal(getStep(trace, 0).event.kind, "request");
    assert.equal(getStep(trace, trace.events.length - 1).event.kind, "stop");
    assert.equal(getStep(trace, trace.events.length - 1).requests, scenario === "tool-error" ? 3 : 2);
    assert.equal(trace.events[0].messages.length, 1);
    assert.ok(trace.events.at(-1).messages.length > 1);
  }
});

test("a failed tool is observable and budget exhaustion does not fabricate an answer", () => {
  const failed = createDemoTrace("tool-error").events.at(-1).messages;
  assert.equal(failed.find((message) => message.role === "tool").isError, true);
  assert.deepEqual(failed.filter((message) => message.role === "tool").map((message) => message.isError), [true, false]);
  assert.equal(failed.at(-1).role, "assistant");
  const budget = createDemoTrace("budget");
  assert.equal(budget.events.at(-1).messages.at(-1).role, "tool");
  assert.equal(getStep(budget, 99).toolResults, 2);
  assert.throws(() => createDemoTrace("unknown"), /未知/);
});

test("step navigation stops at both ends and counters do not include future events", () => {
  const trace = createDemoTrace("readme");
  assert.equal(getStep(trace, -1).position, 0);
  assert.equal(getStep(trace, -1).atStart, true);
  assert.equal(getStep(trace, 100).atEnd, true);
  assert.equal(getStep(trace, 0).requests, 1);
  assert.equal(getStep(trace, 0).toolResults, 0);
  assert.equal(getStep(trace, 2).toolResults, 1);
});

test("file boundary rejects invalid JSON, oversized UTF-8 data, and unsupported formats", () => {
  assert.throws(() => parseTrace("{"), /JSON/);
  assert.throws(() => parseTrace("中".repeat(Math.ceil(MAX_TRACE_BYTES / 3))), /1 MiB/);
  for (const mutation of [
    (trace) => { trace.version = 2; },
    (trace) => { trace.origin = "real-model"; },
    (trace) => { trace.scenario = "__proto__"; },
    (trace) => { trace.scenario = ["readme"]; },
    (trace) => { trace.events = []; },
    (trace) => { trace.events = Array(501).fill(trace.events[0]); },
    (trace) => { trace.events[0].kind = "tool"; },
    (trace) => { trace.events.at(-1).kind = "assistant"; },
    (trace) => { trace.events[1].kind = "stop"; },
  ]) {
    const trace = createDemoTrace("readme");
    mutation(trace);
    assert.throws(() => parseTrace(JSON.stringify(trace)));
  }
});

test("file boundary rejects malformed messages and unresolved call identifiers", () => {
  for (const message of [
    null,
    { role: "system", content: "unknown role" },
    { role: "assistant", content: "missing toolCalls" },
    { role: "assistant", content: "", toolCalls: [{ id: "", name: "read_file", path: "README.md" }] },
    { role: "tool", content: "data", callId: "not-requested", isError: false },
    { role: "user", content: "x".repeat(50_001) },
  ]) {
    const trace = createDemoTrace("readme");
    trace.events[0].messages.push(message);
    assert.throws(() => parseTrace(JSON.stringify(trace)), /消息/);
  }
});

test("import preserves text literally so rendering can use textContent", () => {
  const trace = createDemoTrace("readme");
  trace.events[0].messages[0].content = '<img src=x onerror="alert(1)">';
  assert.equal(parseTrace(JSON.stringify(trace)).events[0].messages[0].content, '<img src=x onerror="alert(1)">');
});
