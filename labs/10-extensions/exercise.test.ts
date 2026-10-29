// Test extension ordering and lifetime independently of a model provider.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createExtensions as student } from "./exercise.ts";
import { composeInstructions, createExtensions as reference } from "../../solutions/10-extensions.ts";
import { createProjectExtension } from "./example.ts";
import type { Message } from "../shared/contracts.ts";

const create = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const signal = new AbortController().signal;
const messages: Message[] = [{ role: "user", content: "检查项目" }];

test("disabled extension contributes neither tools nor hooks", async () => {
  const runtime = create([], [{ ...createProjectExtension(), enabled: false }]);
  assert.deepEqual(runtime.tools, []);
  assert.deepEqual(await runtime.transformContext(messages, signal), messages);
  await runtime.dispose();
});
test("registered capability works without modifying the loop", async () => {
  const runtime = create([], [createProjectExtension()]);
  assert.equal(runtime.tools[0].definition.name, "project_info");
  runtime.tools[0].validate({});
  assert.match(await runtime.tools[0].run({}, signal), /8080/);
  assert.throws(() => runtime.tools[0].validate({ path: "outside" }), /empty object/);
  assert.equal((await runtime.transformContext(messages, signal)).length, 2);
  await runtime.dispose();
});
test("hooks form a serial waterfall and input history stays unchanged", async () => {
  const order: string[] = [];
  const runtime = create([], [
    { name: "first", async beforeModel(current) { order.push("first"); return [...current, { role: "user", content: "A" }]; } },
    { name: "second", async beforeModel(current) { assert.equal(current.at(-1)?.content, "A"); order.push("second"); return [...current, { role: "user", content: "B" }]; } },
  ]);
  assert.deepEqual((await runtime.transformContext(messages, signal)).map(m => m.content), ["检查项目", "A", "B"]);
  assert.deepEqual(order, ["first", "second"]);
  assert.equal(messages.length, 1);
});
test("tool and extension name conflicts are explicit", () => {
  assert.throws(() => create([], [createProjectExtension(), createProjectExtension()]), /Duplicate extension/);
  assert.throws(() => create([], [createProjectExtension(), { ...createProjectExtension(), name: "other" }]), /Duplicate tool/);
});
test("hook failure identifies its owner, stops later hooks and preserves durable inputs", async () => {
  let later = false;
  const runtime = create([], [
    { name: "broken", async beforeModel(current) { current[0].content = "changed temporary view"; throw new Error("fixture"); } },
    { name: "later", async beforeModel(current) { later = true; return [...current]; } },
  ]);
  await assert.rejects(runtime.transformContext(messages, signal), /Extension broken beforeModel failed/);
  assert.equal(later, false);
  assert.equal(messages[0].content, "检查项目");
});
test("a hook cannot send an orphan tool result into the next request", async () => {
  const runtime = create([], [{ name: "invalid", async beforeModel() { return [{ role: "tool", callId: "missing", content: "fake", isError: false }]; } }]);
  await assert.rejects(runtime.transformContext(messages, signal), /Extension invalid/);
});
test("cleanup runs backwards, joins concurrent callers and invalidates extension tools", async () => {
  const order: string[] = [];
  const extension = createProjectExtension();
  const runtime = create([], [
    { ...extension, async dispose() { order.push("first"); } },
    { name: "second", async dispose() { order.push("second"); throw new Error("fixture cleanup"); } },
  ]);
  const first = runtime.dispose();
  assert.equal(runtime.dispose(), first);
  await assert.rejects(first, /cleanup failed/);
  assert.deepEqual(order, ["second", "first"]);
  await assert.rejects(runtime.transformContext(messages, signal), /disposed/);
  await assert.rejects(runtime.tools[0].run({}, signal), /disposed/);
});
test("instruction composition preserves source labels and does not create capabilities", () => {
  const text = composeInstructions("你是项目助手。", "保持端口 8080", [{ name: "review", description: "评阅修改" }]);
  assert.match(text, /操作者明确加载/);
  assert.match(text, /review: 评阅修改/);
});
