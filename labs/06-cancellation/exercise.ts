// Define explicit input boundaries and cancellation for a running conversation.
import type { Message, Model, ToolCall, ToolDefinition, ToolMessage } from "../shared/contracts.ts";

export type UserMessage = Extract<Message, { role: "user" }>;
export type QueueBoundary = "turn" | "idle";
export type QueuePort = { drain: (boundary: QueueBoundary) => UserMessage[] };
export type ControlledOptions = {
  initialMessages: readonly Message[];
  model: Model;
  tools: readonly ToolDefinition[];
  systemPrompt: string;
  execute: (call: ToolCall, signal: AbortSignal) => Promise<ToolMessage>;
  queue: QueuePort;
  signal: AbortSignal;
  maxSteps: number;
  onMessage?: (message: Message) => void | Promise<void>;
};
export type ControlledResult = { status: "completed" | "budget" | "cancelled" | "truncated"; messages: Message[]; steps: number };

/** Keep steering and follow-up inputs in separate FIFO queues. */
export class InputQueue {
  private steering: UserMessage[] = [];
  private followUps: UserMessage[] = [];

  /** Add input to the next completed-turn boundary. */
  steer(content: string): void { this.steering.push({ role: "user", content }); }

  /** Add input to the boundary where the agent would otherwise stop. */
  followUp(content: string): void { this.followUps.push({ role: "user", content }); }

  /** Drain one steering item, or one follow-up only at idle. */
  drain(_boundary: QueueBoundary): UserMessage[] {
    throw new Error("TODO: 在正确边界取出队列消息，保留未到时机的输入");
  }
}

/** Run until normal stop, budget, cancellation, or output truncation. */
export async function runControlled(_options: ControlledOptions): Promise<ControlledResult> {
  throw new Error("TODO: 传播取消，并在工具批次完成后接收 steering，在停止前接收 follow-up");
}
