// Show a real queue boundary and cooperative cancellation in a deterministic run.
import { InputQueue, runControlled } from "../../solutions/06-cancellation.ts";
import type { ModelResponse } from "../shared/contracts.ts";

for (const scenario of ["steer", "cancel"] as const) {
  const queue = new InputQueue();
  const controller = new AbortController();
  let requests = 0;
  const result = await runControlled({
    initialMessages: [{ role: "user", content: "读取 README 后说明启动命令" }], queue,
    signal: controller.signal, systemPrompt: "课程固定场景", tools: [], maxSteps: 4,
    model: async (request): Promise<ModelResponse> => {
      requests++;
      console.log(scenario, "request", requests, request.messages.map((message) => message.content));
      return { message: { role: "assistant", content: requests === 1 ? "读取中" : "npm run dev", toolCalls: requests === 1 ? [{ id: "r1", name: "read", arguments: {} }] : [] }, stopReason: requests === 1 ? "tool_calls" : "end", usage: { inputTokens: 0, outputTokens: 0 } };
    },
    execute: async (call, signal) => {
      signal.throwIfAborted();
      if (scenario === "cancel") controller.abort();
      else { queue.steer("用中文解释"); queue.followUp("再给出一句总结"); }
      return { role: "tool", callId: call.id, content: "启动：npm run dev", isError: false };
    },
  });
  console.log(JSON.stringify({ scenario, status: result.status, requests, messages: result.messages }, null, 2));
}
