// Run an incremental stream fixture; no provider request or fabricated live output.
import { setTimeout } from "node:timers/promises";
import { consumeStream } from "../../solutions/05-streaming.ts";
import type { StreamPart } from "./exercise.ts";

const controller = new AbortController();
async function* fixture(): AsyncGenerator<StreamPart> {
  yield { type: "text", delta: "准备读取 " };
  await setTimeout(80, undefined, { signal: controller.signal });
  yield { type: "text", delta: "README。" };
  yield { type: "tool-start", id: "r1", name: "read" };
  yield { type: "tool-delta", id: "r1", delta: '{"path":' };
  await setTimeout(80, undefined, { signal: controller.signal });
  yield { type: "tool-delta", id: "r1", delta: '"README.md"}' };
  yield { type: "finish", stopReason: "tool_calls", usage: { inputTokens: 12, outputTokens: 8 } };
}

console.log("来源：固定增量 fixture；用量也是 fixture，不是真实模型计费。");
const response = await consumeStream(fixture(), controller.signal, (event) => { console.log(JSON.stringify(event)); });
console.log("工具只在下游循环拿到这个完整响应后才能执行：", response.message.toolCalls);
