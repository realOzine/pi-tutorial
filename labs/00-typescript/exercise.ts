// Practice discriminated unions and cooperative cancellation before building a loop.
export type LearningMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolNames: string[] }
  | { role: 'tool'; callId: string; content: string; isError: boolean };

export type OperationResult =
  | { status: 'completed'; value: string }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' };

/** Describe one message using only fields available for its role. */
export function describeMessage(_message: LearningMessage): string {
  throw new Error('TODO: 按 role 分支，格式见测试');
}

/** Await one operation, distinguishing ordinary failure from cancellation. */
export async function runOperation(_operation: (signal: AbortSignal) => Promise<string>, _signal: AbortSignal): Promise<OperationResult> {
  throw new Error('TODO: 检查取消、await 结果、收窄 unknown 异常');
}
