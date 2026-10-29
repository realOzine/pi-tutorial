// Evaluation tests prevent missing failures, wrong denominators and invented cost measurements.
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate as student } from "./exercise.ts";
import { evaluate as reference } from "../../solutions/11-evaluation.ts";
import { createFixtureRunner, TASKS } from "./tasks.ts";
import type { EvaluationMetadata, EvaluationRun, EvaluationTask } from "./exercise.ts";

const evaluate = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const metadata: EvaluationMetadata = { label: "test", revision: "fixture-v1", runKind: "fixture", provider: "none", model: "none", configuration: { strategy: "trim" } };
const completed: EvaluationRun = { status: "completed", answer: "ok", modelCalls: 2, toolCalls: 1, trace: ["request", "answer"] };

test("all cases remain in the denominator, including runner exceptions", async () => {
  const tasks: EvaluationTask[] = ["good", "broken"].map(id => ({ id, prompt: id, judge: run => ({ passed: run.status === "completed", reason: "completion required" }) }));
  const result = await evaluate(tasks, async task => { if (task.id === "broken") throw new Error("fixture transport"); return completed; }, metadata);
  assert.equal(result.rows.length, 2);
  assert.equal(result.summary.passRate, 0.5);
  assert.equal(result.summary.completionRate, 0.5);
  assert.equal(result.rows[1].run.failure?.layer, "runtime");
  assert.equal(result.summary.modelCalls, null);
});
test("unknown monetary cost is null, never reported as free", async () => {
  const result = await evaluate([{ id: "one", prompt: "p", judge: () => ({ passed: true, reason: "fixture" }) }], async () => completed, metadata);
  assert.equal(result.summary.costUsd, null);
  assert.equal(result.summary.usage, null);
  assert.match(result.summary.costUnavailableReason ?? "", /no provider-priced/);
  assert.ok(result.rows[0].elapsedMs >= 0);
  assert.deepEqual(result.metadata, metadata);
});
test("explicit known usage and cost are preserved and summed", async () => {
  const tasks = ["a", "b"].map(id => ({ id, prompt: id, judge: () => ({ passed: true, reason: "fixture" }) }));
  const result = await evaluate(tasks, async () => ({ ...completed, costUsd: 0.01, usage: { inputTokens: 100, outputTokens: 10 } }), metadata);
  assert.equal(result.summary.costUsd, 0.02);
  assert.equal(result.summary.modelCalls, 4);
  assert.deepEqual(result.rows[0].run.usage, { inputTokens: 100, outputTokens: 10 });
  assert.deepEqual(result.summary.usage, { inputTokens: 200, outputTokens: 20 });
});
test("judge failure fails the case without changing the agent's successful run", async () => {
  const result = await evaluate([{ id: "bad-judge", prompt: "p", judge: () => { throw new Error("bad assertion"); } }], async () => completed, metadata);
  assert.equal(result.summary.passed, 0);
  assert.equal(result.summary.completed, 1);
  assert.match(result.rows[0].judgement.reason, /Judge failed/);
});
test("empty suites and duplicate ids fail rather than produce misleading metrics", async () => {
  await assert.rejects(evaluate([], async () => completed, metadata), /at least one/);
  await assert.rejects(evaluate([TASKS[0], TASKS[0]], async () => completed, metadata), /Duplicate/);
});
test("fixed comparison changes only context policy and retains every failure injection", async () => {
  const baseline = await evaluate(TASKS, createFixtureRunner("trim"), metadata);
  const candidate = await evaluate(TASKS, createFixtureRunner("summary"), { ...metadata, configuration: { strategy: "summary" } });
  assert.equal(baseline.summary.passed, 4);
  assert.equal(candidate.summary.passed, 5);
  assert.equal(candidate.summary.completed, 1);
  assert.equal(candidate.summary.modelCalls, 0);
  assert.equal(candidate.rows[0].run.answer, "8080");
  assert.equal(baseline.rows[0].run.answer, "unknown");
  assert.deepEqual(candidate.rows.slice(1).map(row => row.run.status), ["error", "budget", "error", "cancelled"]);
});
