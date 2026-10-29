// 第一课：由学习者补全模型、工具和反馈之间的循环。

export type ToolCall = { id: string; name: string; path: string };

export type AssistantMessage = {
  role: "assistant";
  content: string;
  toolCalls: ToolCall[];
};

export type Message =
  | { role: "user"; content: string }
  | AssistantMessage
  | { role: "tool"; callId: string; content: string; isError: boolean };

export type LoopOptions = {
  initialMessages: readonly Message[];
  model: (messages: readonly Message[]) => Promise<AssistantMessage>;
  executeTool: (call: ToolCall) => Promise<string>;
  maxSteps: number;
};

export type LoopResult = {
  status: "completed" | "budget";
  messages: Message[];
  steps: number;
};

/** 执行至模型不再请求工具，或耗尽模型调用次数。 */
export async function runAgentLoop(options: LoopOptions): Promise<LoopResult> {
  // TODO：只在这里补全循环。先预测消息顺序，再运行 loop.test.ts。
  // 需要处理：追加消息、工具结果关联、工具异常、文字与工具并存、调用预算。
  // maxSteps 是模型调用次数，不是工具调用次数；初始消息不要原地修改。
  void options;
  throw new Error("尚未实现 runAgentLoop：请完成 labs/01-agent-loop/loop.ts 中的 TODO。");
}
