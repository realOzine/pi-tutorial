// Reference answer for the two TypeScript prerequisites.
import type { LearningMessage, OperationResult } from '../labs/00-typescript/exercise.ts';

export function describeMessage(message: LearningMessage): string {
  switch (message.role) {
    case 'user': return `用户：${message.content}`;
    case 'assistant': return `助手：${message.content}；工具数=${message.toolNames.length}`;
    case 'tool': return `工具 ${message.callId}：${message.isError ? '失败' : '成功'}；${message.content}`;
  }
}

export async function runOperation(operation: (signal: AbortSignal) => Promise<string>, signal: AbortSignal): Promise<OperationResult> {
  if (signal.aborted) return { status: 'cancelled' };
  try {
    const value = await operation(signal);
    if (signal.aborted) return { status: 'cancelled' };
    return { status: 'completed', value };
  } catch (error) {
    if (signal.aborted) return { status: 'cancelled' };
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}
