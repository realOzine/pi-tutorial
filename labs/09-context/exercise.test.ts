// Check context boundaries and evidence retention; no model or tokenizer is used.
import assert from "node:assert/strict";
import { test } from "node:test";
import { selectContext as student } from "./exercise.ts";
import { selectContext as reference } from "../../solutions/09-context.ts";
import type { Message } from "../shared/contracts.ts";

const select = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const messages: Message[] = [
  { role: "user", content: "兼容约束：端口必须保留 8080。" },
  { role: "assistant", content: "", toolCalls: [{ id: "read-1", name: "read", arguments: { path: "log" } }] },
  { role: "tool", callId: "read-1", content: "重复日志".repeat(300), isError: false },
  { role: "assistant", content: "已记录端口约束", toolCalls: [] },
  { role: "user", content: "现在应该使用哪个端口？" },
];

test("full context reports its measured characters and refuses an undersized budget", async () => {
  const result = await select(messages, { mode: "full", maxCharacters: 300 });
  assert.equal(result.status, "over_budget");
  assert.equal(result.characters, JSON.stringify(messages).length);
  assert.deepEqual(result.messages, messages);
});
test("trim removes whole old turns, never a lone tool request or result", async () => {
  const result = await select(messages, { mode: "trim", maxCharacters: 300 });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.messages, [messages[4]]);
  assert.deepEqual(result.omittedIndexes, [0, 1, 2, 3]);
  assert.deepEqual(result.keptIndexes, [4]);
});
test("a current turn larger than budget stays intact and blocks the request", async () => {
  const result = await select(messages.slice(0, 4), { mode: "trim", maxCharacters: 300 });
  assert.equal(result.status, "over_budget");
  assert.deepEqual(result.messages, messages.slice(0, 4));
});
test("summary carries evidence indexes and can preserve a constraint that trim drops", async () => {
  let calls = 0;
  const before = JSON.stringify(messages);
  const result = await select(messages, { mode: "summary", maxCharacters: 300 }, async history => {
    calls++;
    assert.deepEqual(history, messages.slice(0, 4));
    return "必须保留端口 8080；来源：第0条用户消息。";
  });
  assert.equal(result.status, "ready");
  assert.match(result.messages[0].content, /8080/);
  assert.deepEqual(result.summary?.sourceIndexes, [0, 1, 2, 3]);
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(messages), before);
});
test("failed and oversized summaries cannot erase the originals or pretend to fit", async () => {
  const before = JSON.stringify(messages);
  const failed = await select(messages, { mode: "summary", maxCharacters: 300 }, async () => { throw new Error("fixture provider failed"); });
  assert.equal(failed.status, "summary_failed");
  assert.deepEqual(failed.messages, messages);
  const large = await select(messages, { mode: "summary", maxCharacters: 300 }, async () => "x".repeat(400));
  assert.equal(large.status, "over_budget");
  assert.equal(JSON.stringify(messages), before);
});
test("small contexts need no summary call, even under summary policy", async () => {
  const result = await select([messages[4]], { mode: "summary", maxCharacters: 300 }, async () => { throw new Error("must not call"); });
  assert.equal(result.status, "ready");
  assert.equal(result.summary, undefined);
});
test("malformed tool histories are rejected before pruning hides the problem", async () => {
  await assert.rejects(select([messages[2]], { mode: "trim", maxCharacters: 300 }), /Orphan/);
  await assert.rejects(select(messages.slice(0, 2), { mode: "trim", maxCharacters: 300 }), /Incomplete/);
});
test("cancellation reaches the summarizer and propagates as cancellation", async () => {
  const controller = new AbortController();
  await assert.rejects(select(messages, { mode: "summary", maxCharacters: 300 }, async (_, signal) => {
    assert.equal(signal, controller.signal);
    controller.abort(new Error("stop summary"));
    return "late result";
  }, controller.signal), /stop summary/);
});
