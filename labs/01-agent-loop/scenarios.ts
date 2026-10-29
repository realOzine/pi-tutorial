// 用内存文件和脚本模型生成可复现的第一课执行轨迹。

import type { AssistantMessage, LoopOptions, LoopResult, Message, ToolCall } from "./loop.ts";

export type Scenario = "readme" | "tool-error" | "budget";

export type TraceEvent = {
  kind: "request" | "assistant" | "tool" | "stop";
  label: string;
  messages: Message[];
};

export type Trace = {
  version: 1;
  origin: "scripted-model";
  scenario: Scenario;
  events: TraceEvent[];
};

/** 在确定性教具中运行循环，保留每个时刻的消息快照。 */
export async function runScenario(
  scenario: Scenario,
  runLoop: (options: LoopOptions) => Promise<LoopResult>,
): Promise<{ result: LoopResult; trace: Trace }> {
  const trace: Trace = { version: 1, origin: "scripted-model", scenario, events: [] };
  let visibleMessages: Message[] = [];
  let requests = 0;
  const initialMessages: Message[] = [{
    role: "user",
    content: scenario === "tool-error"
      ? "读取 docs/README.md；如果不存在，再尝试 README.md，告诉我项目名称和启动命令。"
      : "读取 README.md，告诉我项目名称和启动命令。",
  }];

  const result = await runLoop({
    initialMessages,
    maxSteps: scenario === "budget" ? 2 : 4,
    async model(messages) {
      requests += 1;
      visibleMessages = structuredClone([...messages]);
      trace.events.push({ kind: "request", label: `第 ${requests} 次模型调用`, messages: structuredClone(visibleMessages) });
      const assistant = scriptedReply(scenario, requests, messages);
      visibleMessages.push(assistant);
      trace.events.push({ kind: "assistant", label: assistant.toolCalls.length ? "模型请求工具" : "模型给出回答", messages: structuredClone(visibleMessages) });
      return assistant;
    },
    async executeTool(call) {
      try {
        const content = readMemoryFile(call);
        visibleMessages.push({ role: "tool", callId: call.id, content, isError: false });
        trace.events.push({ kind: "tool", label: `工具成功：${call.path}`, messages: structuredClone(visibleMessages) });
        return content;
      } catch (error) {
        const content = error instanceof Error ? error.message : String(error);
        visibleMessages.push({ role: "tool", callId: call.id, content, isError: true });
        trace.events.push({ kind: "tool", label: `工具失败：${call.path}`, messages: structuredClone(visibleMessages) });
        throw error;
      }
    },
  });

  trace.events.push({
    kind: "stop",
    label: result.status === "completed" ? "completed：模型不再请求工具" : "budget：模型调用预算已用完",
    messages: structuredClone(result.messages),
  });
  return { result, trace };
}

function scriptedReply(scenario: Scenario, requests: number, messages: readonly Message[]): AssistantMessage {
  const last = messages.at(-1);
  if (scenario !== "budget" && last?.role === "tool" && !last.isError) {
    return { role: "assistant", content: `内存文件内容：\n${last.content}`, toolCalls: [] };
  }
  return {
    role: "assistant",
    content: last?.role === "tool" && last.isError ? "读取失败，尝试根目录 README.md。" : "先读取文件，再根据结果回答。",
    toolCalls: [{
      id: `read-${requests}`,
      name: "read_file",
      path: scenario === "tool-error" && requests === 1 ? "docs/README.md" : "README.md",
    }],
  };
}

function readMemoryFile(call: ToolCall): string {
  if (call.name !== "read_file") throw new Error(`未知工具：${call.name}`);
  if (call.path !== "README.md") throw new Error(`找不到内存文件：${call.path}`);
  return "# Tiny Notes\n启动命令：npm run dev\n这是实验中的内存文件，不是课程仓库的 README。";
}
