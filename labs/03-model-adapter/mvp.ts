// Reuse one small loop with either a deterministic model or the real HTTP adapter.
import type { Message, Model, ModelResponse, Tool } from "../shared/contracts.ts";
import { executeResponseTools } from "../../solutions/02-tool-protocol.ts";

export type MvpOptions = { model: Model; tools: readonly Tool[]; messages: readonly Message[];
  systemPrompt: string; maxSteps: number; signal: AbortSignal };
export type MvpResult = { status: "completed" | "budget" | "truncated"; messages: Message[];
  steps: number; usage: ModelResponse["usage"] };

/** Run the lesson 01 control flow against the richer lesson 02/03 protocol. */
export async function runMvp(options: MvpOptions): Promise<MvpResult> {
  if (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 0) throw new Error("Invalid maxSteps");
  const messages = [...options.messages];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let steps = 0;
  while (steps < options.maxSteps) {
    options.signal.throwIfAborted();
    const response = await options.model({ systemPrompt: options.systemPrompt, messages,
      tools: options.tools.map((tool) => tool.definition) }, options.signal);
    steps++;
    options.signal.throwIfAborted();
    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;
    messages.push(response.message);
    messages.push(...await executeResponseTools(response, options.tools, options.signal));
    if (response.stopReason === "length") return { status: "truncated", messages, steps, usage };
    if (response.message.toolCalls.length === 0) return { status: "completed", messages, steps, usage };
  }
  return { status: "budget", messages, steps, usage };
}
