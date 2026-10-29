// 用可复现的消息与工具验证学习者循环；环境变量只选择参考实现。

import assert from "node:assert/strict";
import { test } from "node:test";
import { runAgentLoop, type AssistantMessage, type Message } from "./loop.ts";
import { runAgentLoop as referenceLoop } from "../../solutions/01-agent-loop.ts";
import { runScenario } from "./scenarios.ts";

const run = process.env.PI_TUTORIAL_REFERENCE === "1" ? referenceLoop : runAgentLoop;

test("没有工具请求时结束，并保留用户与助手消息", async () => {
  const initialMessages: Message[] = [{ role: "user", content: "你好" }];
  let requests = 0;
  const answer: AssistantMessage = { role: "assistant", content: "你好。", toolCalls: [] };
  const result = await run({
    initialMessages,
    maxSteps: 3,
    async model(messages) {
      assert.equal(++requests, 1, "完成回答后不应再调用模型");
      assert.deepEqual(messages, initialMessages);
      return answer;
    },
    async executeTool() { assert.fail("没有请求工具，不应执行工具"); },
  });
  assert.deepEqual(result, { status: "completed", steps: 1, messages: [...initialMessages, answer] });
  assert.equal(initialMessages.length, 1, "不应修改调用者提供的初始数组");
});

test("有文字也有工具时，追加工具结果后继续调用模型", async () => {
  const initialMessages: Message[] = [{ role: "user", content: "读 README" }];
  const request: AssistantMessage = {
    role: "assistant", content: "我先看文件。", toolCalls: [{ id: "call-1", name: "read_file", path: "README.md" }],
  };
  const answer: AssistantMessage = { role: "assistant", content: "项目是 Tiny Notes。", toolCalls: [] };
  const tool: Message = { role: "tool", callId: "call-1", content: "# Tiny Notes", isError: false };
  let requests = 0;
  const result = await run({
    initialMessages, maxSteps: 3,
    async model(messages) {
      requests += 1;
      assert.ok(requests <= 2, "两次模型请求已经足够");
      if (requests === 1) return request;
      assert.deepEqual(messages, [...initialMessages, request, tool], "下一轮必须能看到请求和对应观测");
      return answer;
    },
    async executeTool(call) {
      assert.deepEqual(call, request.toolCalls[0]);
      return "# Tiny Notes";
    },
  });
  assert.deepEqual(result, { status: "completed", steps: 2, messages: [...initialMessages, request, tool, answer] });
});

test("同一轮多个工具按顺序执行，结果保留各自 callId", async () => {
  const order: string[] = [];
  let requests = 0;
  const result = await run({
    initialMessages: [{ role: "user", content: "读取两个文件" }], maxSteps: 2,
    async model(messages) {
      requests += 1;
      assert.ok(requests <= 2);
      if (requests === 1) return {
        role: "assistant", content: "读取。", toolCalls: [
          { id: "a", name: "read_file", path: "a.md" },
          { id: "b", name: "read_file", path: "b.md" },
        ],
      };
      assert.deepEqual(messages.slice(-2), [
        { role: "tool", callId: "a", content: "a.md 内容", isError: false },
        { role: "tool", callId: "b", content: "b.md 内容", isError: false },
      ]);
      return { role: "assistant", content: "读取完成。", toolCalls: [] };
    },
    async executeTool(call) { order.push(call.id); return `${call.path} 内容`; },
  });
  assert.deepEqual(order, ["a", "b"]);
  assert.equal(result.status, "completed");
  assert.equal(result.steps, 2, "工具调用不应额外消耗模型调用预算");
});

test("工具异常作为 isError 结果回传，模型可以继续", async () => {
  let requests = 0;
  const result = await run({
    initialMessages: [{ role: "user", content: "读丢失的文件" }], maxSteps: 2,
    async model(messages) {
      requests += 1;
      assert.ok(requests <= 2);
      if (requests === 1) return {
        role: "assistant", content: "尝试读取。", toolCalls: [{ id: "missing", name: "read_file", path: "missing.md" }],
      };
      assert.deepEqual(messages.at(-1), { role: "tool", callId: "missing", content: "文件不存在", isError: true });
      return { role: "assistant", content: "文件不存在，需要新的路径。", toolCalls: [] };
    },
    async executeTool() { throw new Error("文件不存在"); },
  });
  assert.equal(result.status, "completed");
  assert.equal(result.steps, 2);
});

test("预算用完后停止，但保留最后一次请求的工具结果", async () => {
  let requests = 0;
  let tools = 0;
  const result = await run({
    initialMessages: [{ role: "user", content: "反复读文件" }], maxSteps: 2,
    async model() {
      requests += 1;
      assert.ok(requests <= 2, "预算用完后不应发出第三次请求");
      return { role: "assistant", content: "继续读。", toolCalls: [{ id: `c-${requests}`, name: "read_file", path: "README.md" }] };
    },
    async executeTool() { tools += 1; return "文件内容"; },
  });
  assert.equal(result.status, "budget");
  assert.equal(result.steps, 2);
  assert.equal(tools, 2);
  assert.equal(result.messages.length, 5);
  assert.deepEqual(result.messages.at(-1), { role: "tool", callId: "c-2", content: "文件内容", isError: false });
});

test("零预算不调用模型或工具", async () => {
  const initialMessages: Message[] = [{ role: "user", content: "不要运行" }];
  const result = await run({
    initialMessages, maxSteps: 0,
    async model() { assert.fail("零预算不能调用模型"); },
    async executeTool() { assert.fail("零预算不能执行工具"); },
  });
  assert.deepEqual(result, { status: "budget", steps: 0, messages: initialMessages });
});

test("模型异常继续向调用者抛出，不伪装成工具失败或完成", async () => {
  const failure = new Error("脚本模型故障");
  await assert.rejects(run({
    initialMessages: [{ role: "user", content: "请求" }], maxSteps: 1,
    async model() { throw failure; },
    async executeTool() { assert.fail("模型没有返回工具请求"); },
  }), (error: unknown) => error === failure);
});

test("脚手架三个场景产生约定轨迹，历史快照相互独立", async () => {
  for (const scenario of ["readme", "tool-error", "budget"] as const) {
    const { result, trace } = await runScenario(scenario, referenceLoop);
    assert.equal(trace.version, 1);
    assert.equal(trace.origin, "scripted-model");
    assert.equal(trace.scenario, scenario);
    assert.equal(trace.events[0].kind, "request");
    assert.equal(trace.events.at(-1)?.kind, "stop");
    assert.equal(trace.events[0].messages.length, 1);
    assert.equal(result.status, scenario === "budget" ? "budget" : "completed");
    assert.ok(trace.events.at(-1)?.label.startsWith(result.status));
    assert.ok(trace.events.length <= 500);
    assert.ok(trace.events.every((event) => event.messages.length <= 200));
    assert.ok(Buffer.byteLength(JSON.stringify(trace)) <= 1024 * 1024);
    if (scenario === "tool-error") {
      assert.equal(result.steps, 3);
      assert.ok(result.messages.some((message) => message.role === "tool" && message.isError));
    }
    const original = trace.events.at(-1)?.messages[0].content;
    trace.events[0].messages[0].content = "修改一个快照";
    assert.equal(trace.events.at(-1)?.messages[0].content, original);
    assert.equal(result.messages[0].content, original);
  }
});
