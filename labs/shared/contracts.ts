// Shared wire-independent contracts used from lesson 02 onward.
export type ToolCall = { id: string; name: string; arguments: unknown };
export type AssistantMessage = { role: "assistant"; content: string; toolCalls: ToolCall[] };
export type ToolMessage = { role: "tool"; callId: string; content: string; isError: boolean };
export type Message = { role: "user"; content: string } | AssistantMessage | ToolMessage;
export type ToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };
export type Tool = {
  definition: ToolDefinition;
  execution: "parallel" | "sequential";
  validate: (arguments_: unknown) => void;
  run: (arguments_: unknown, signal: AbortSignal) => Promise<string>;
};
export type ModelRequest = { systemPrompt: string; messages: readonly Message[]; tools: readonly ToolDefinition[] };
export type ModelResponse = {
  message: AssistantMessage;
  usage: { inputTokens: number; outputTokens: number };
  stopReason: "end" | "tool_calls" | "length";
};
export type Model = (request: ModelRequest, signal: AbortSignal) => Promise<ModelResponse>;
