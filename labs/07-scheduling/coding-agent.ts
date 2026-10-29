// The lesson 07 loop upgrades the lesson 06 sequence with the real batch scheduler.
import { executeToolCall } from "../../solutions/02-tool-protocol.ts";
import { executeBatch } from "../../solutions/07-scheduling.ts";
import type { QueuePort, ControlledResult } from "../06-cancellation/exercise.ts";
import type { Message, Model, ModelResponse, Tool, ToolMessage } from "../shared/contracts.ts";

export type ScheduledOptions = {
  initialMessages: readonly Message[];
  systemPrompt: string;
  tools: readonly Tool[];
  model: Model;
  queue: QueuePort;
  signal: AbortSignal;
  maxSteps: number;
  onMessage?: (message: Message) => void | Promise<void>;
  onToolResult?: (result: ToolMessage) => void | Promise<void>;
};

/** Run a cancellable coding conversation with queued input and ordered batch results. */
export async function runScheduled(options: ScheduledOptions): Promise<ControlledResult> {
  const { model, signal, queue, tools } = options;
  const messages: Message[] = [...options.initialMessages];
  let steps = 0;
  const append = async (message: Message) => { messages.push(message); await options.onMessage?.(message); };
  if (signal.aborted) return { status: "cancelled", messages, steps };
  for (const input of queue.drain("turn")) await append(input);
  while (steps < options.maxSteps) {
    if (signal.aborted) return { status: "cancelled", messages, steps };
    steps++;
    let response: ModelResponse;
    try {
      response = await model({ systemPrompt: options.systemPrompt, messages, tools: tools.map((tool) => tool.definition) }, signal);
    } catch (error) {
      if (signal.aborted) return { status: "cancelled", messages, steps };
      throw error;
    }
    if (signal.aborted) return { status: "cancelled", messages, steps };
    await append(response.message);
    const results: ToolMessage[] = response.stopReason === "length"
      ? response.message.toolCalls.map((call) => ({ role: "tool", callId: call.id, content: "Truncated response: not executed", isError: true }))
      : await executeBatch(response.message.toolCalls, tools, signal, { execute: executeToolCall, onResult: options.onToolResult });
    for (const result of results) await append(result);
    if (signal.aborted) return { status: "cancelled", messages, steps };
    if (response.stopReason === "length") return { status: "truncated", messages, steps };
    const steering = queue.drain("turn");
    for (const input of steering) await append(input);
    if (response.message.toolCalls.length || steering.length) continue;
    const followUps = queue.drain("idle");
    for (const input of followUps) await append(input);
    if (!followUps.length) return { status: "completed", messages, steps };
  }
  return { status: signal.aborted ? "cancelled" : "budget", messages, steps };
}
