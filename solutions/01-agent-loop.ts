// 第一课参考实现；先完成练习，再对照此文件。

import type { LoopOptions, LoopResult, Message } from "../labs/01-agent-loop/loop.ts";

/** 顺序执行工具，把结果送回模型，并在调用预算内结束。 */
export async function runAgentLoop(options: LoopOptions): Promise<LoopResult> {
  const messages: Message[] = [...options.initialMessages];
  let steps = 0;

  while (steps < options.maxSteps) {
    const assistant = await options.model(messages);
    steps += 1;
    messages.push(assistant);
    if (assistant.toolCalls.length === 0) {
      return { status: "completed", messages, steps };
    }

    for (const call of assistant.toolCalls) {
      try {
        const content = await options.executeTool(call);
        messages.push({ role: "tool", callId: call.id, content, isError: false });
      } catch (error) {
        messages.push({
          role: "tool",
          callId: call.id,
          content: error instanceof Error ? error.message : String(error),
          isError: true,
        });
      }
    }
  }

  return { status: "budget", messages, steps };
}
