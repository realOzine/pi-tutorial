// Introduce user input only at explicit boundaries and preserve completed effects on cancel.
import type { Message, ModelResponse, ToolMessage } from "../labs/shared/contracts.ts";
import type { ControlledOptions, ControlledResult, QueueBoundary, UserMessage } from "../labs/06-cancellation/exercise.ts";

/** Keep independent FIFO queues; each boundary consumes at most one message. */
export class InputQueue {
  private steering: UserMessage[] = [];
  private followUps: UserMessage[] = [];

  /** Queue a message for the next turn boundary. */
  steer(content: string): void { this.steering.push({ role: "user", content }); }

  /** Queue a message for when the current task would stop. */
  followUp(content: string): void { this.followUps.push({ role: "user", content }); }

  /** Prefer steering; follow-up is eligible only at idle. */
  drain(boundary: QueueBoundary): UserMessage[] {
    const message = this.steering.shift() ?? (boundary === "idle" ? this.followUps.shift() : undefined);
    return message ? [message] : [];
  }
}

/** Preserve tool-result pairing and stop starting work after cancellation is observed. */
export async function runControlled(options: ControlledOptions): Promise<ControlledResult> {
  const { model, signal, queue, execute } = options;
  const messages: Message[] = [...options.initialMessages];
  let steps = 0;
  const append = async (message: Message) => {
    messages.push(message);
    await options.onMessage?.(message);
  };
  if (signal.aborted) return { status: "cancelled", messages, steps };
  for (const input of queue.drain("turn")) await append(input);
  while (steps < options.maxSteps) {
    if (signal.aborted) return { status: "cancelled", messages, steps };
    steps++;
    let response: ModelResponse;
    try {
      response = await model({ systemPrompt: options.systemPrompt, messages, tools: options.tools }, signal);
    } catch (error) {
      if (signal.aborted) return { status: "cancelled", messages, steps };
      throw error;
    }
    if (signal.aborted) return { status: "cancelled", messages, steps };
    await append(response.message);
    for (const call of response.message.toolCalls) {
      let result: ToolMessage;
      if (signal.aborted || response.stopReason === "length") {
        result = { role: "tool", callId: call.id, content: signal.aborted ? "Cancelled before execution" : "Truncated response: not executed", isError: true };
      } else {
        try {
          result = await execute(call, signal);
        } catch (error) {
          result = { role: "tool", callId: call.id, content: error instanceof Error ? error.message : String(error), isError: true };
        }
      }
      await append(result);
    }
    if (signal.aborted) return { status: "cancelled", messages, steps };
    if (response.stopReason === "length") return { status: "truncated", messages, steps };
    const steering = queue.drain("turn");
    for (const input of steering) await append(input);
    if (response.message.toolCalls.length > 0 || steering.length > 0) continue;
    const followUps = queue.drain("idle");
    for (const input of followUps) await append(input);
    if (followUps.length === 0) return { status: "completed", messages, steps };
  }
  return { status: signal.aborted ? "cancelled" : "budget", messages, steps };
}
