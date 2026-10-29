// Assemble the preceding lessons while preserving uncertainty across process restarts.
import type { AgentOptions, AgentResult } from '../labs/12-capstone/exercise.ts';
import { executeResponseTools, executeToolCall } from './02-tool-protocol.ts';
import { executeBatch } from './07-scheduling.ts';
import { selectContext } from './09-context.ts';

/** Persist intent before effects and refuse automatic replay of unresolved calls. */
export async function runAgent(options: AgentOptions): Promise<AgentResult> {
  const { session, queue, signal } = options;
  if (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 0) throw new Error('Invalid maxSteps');
  let steps = 0;
  const usage = { inputTokens: 0, outputTokens: 0 };
  const result = (status: AgentResult['status']): AgentResult => ({ status, steps, messages: session.project().messages, usage });
  if (session.project().status === 'needs_review') return result('needs_review');
  if (signal.aborted) return result('cancelled');
  if (options.task) session.appendMessage({ role: 'user', content: options.task });
  const initialInput = queue.drain('turn');
  for (const message of initialInput) session.appendMessage(message);
  const last = session.project().messages.at(-1);
  // A completed restored conversation needs new input, not another autonomous invocation.
  if (!options.task && initialInput.length === 0 && (!last || (last.role === 'assistant' && last.toolCalls.length === 0))) {
    const followUps = queue.drain('idle');
    if (followUps.length === 0) return result('completed');
    for (const message of followUps) session.appendMessage(message);
  }
  try {
    while (steps < options.maxSteps) {
      signal.throwIfAborted();
      const original = session.project().messages;
      const prepared = options.transformContext ? await options.transformContext(original, signal) : original;
      const selection = await selectContext(prepared, options.context, options.summarize, signal);
      await options.onEvent?.({ type: 'context', selection });
      if (selection.status !== 'ready') return result('context_limit');
      signal.throwIfAborted();
      await options.onEvent?.({ type: 'request', step: steps + 1 });
      signal.throwIfAborted();
      steps++;
      const response = await options.model({ systemPrompt: options.systemPrompt, messages: selection.messages,
        tools: options.tools.map(tool => tool.definition) }, signal);
      usage.inputTokens += response.usage.inputTokens;
      usage.outputTokens += response.usage.outputTokens;
      signal.throwIfAborted();
      session.appendMessage(response.message);
      await options.onEvent?.({ type: 'response', response });
      if (response.stopReason === 'length') {
        for (const message of await executeResponseTools(response, options.tools, signal)) session.appendMessage(message);
        return result('truncated');
      }
      const results = await executeBatch(response.message.toolCalls, options.tools, signal, {
        execute: executeToolCall,
        onResult: async message => { await options.onEvent?.({ type: 'tool', result: message }); },
      });
      // Cancellation can race an external write: keep pending intent for review instead of fabricating certainty.
      signal.throwIfAborted();
      for (const message of results) session.appendMessage(message);
      const steering = queue.drain('turn');
      for (const message of steering) session.appendMessage(message);
      if (response.message.toolCalls.length > 0 || steering.length > 0) continue;
      const followUps = queue.drain('idle');
      for (const message of followUps) session.appendMessage(message);
      if (followUps.length === 0) return result('completed');
    }
    return result('budget');
  } catch (error) {
    if (signal.aborted) return result('cancelled');
    throw error;
  }
}
