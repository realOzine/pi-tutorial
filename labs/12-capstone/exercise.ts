// Compose the learned boundaries into one persistent coding-agent run.
import type { Message, Model, ModelResponse, Tool, ToolMessage } from '../shared/contracts.ts';
import type { QueuePort } from '../06-cancellation/exercise.ts';
import type { ContextOptions, ContextSelection, Summarizer } from '../09-context/exercise.ts';
import type { SessionStore } from '../../solutions/08-sessions.ts';

export type RunEvent =
  | { type: 'context'; selection: ContextSelection }
  | { type: 'request'; step: number }
  | { type: 'response'; response: ModelResponse }
  | { type: 'tool'; result: ToolMessage };
export type AgentOptions = {
  model: Model;
  tools: readonly Tool[];
  session: SessionStore;
  queue: QueuePort;
  signal: AbortSignal;
  task?: string;
  systemPrompt: string;
  maxSteps: number;
  context: ContextOptions;
  summarize?: Summarizer;
  transformContext?: (messages: readonly Message[], signal: AbortSignal) => Promise<Message[]>;
  onEvent?: (event: RunEvent) => void | Promise<void>;
};
export type AgentResult = {
  status: 'completed' | 'budget' | 'cancelled' | 'needs_review' | 'context_limit' | 'truncated';
  steps: number;
  messages: Message[];
  /** Sum of completed responses only; interrupted requests may have unreported provider usage. */
  usage: ModelResponse['usage'];
};

/** Run one task without replaying effects whose persisted outcome is unknown. */
export async function runAgent(_options: AgentOptions): Promise<AgentResult> {
  throw new Error('TODO 12: 将队列、上下文、模型、工具调度与持久化接成完整循环');
}
