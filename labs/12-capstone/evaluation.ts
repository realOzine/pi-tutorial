// Reuse lesson 11 to distinguish actual file repair from plausible final answers.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceTools } from '../../solutions/04-workspace-tools.ts';
import { InputQueue } from '../../solutions/06-cancellation.ts';
import { openSession } from '../../solutions/08-sessions.ts';
import { evaluate } from '../../solutions/11-evaluation.ts';
import { runAgent } from '../../solutions/12-capstone.ts';
import type { EvaluationReport, EvaluationTask } from '../11-evaluation/exercise.ts';
import type { Model } from '../shared/contracts.ts';
import { createFixture, createScriptedModel, gradeFixture, TASK } from './fixture.ts';

/** Evaluate real file outcomes under normal, false-answer and tool-failure fixtures, without paid calls. */
export async function evaluateCapstone(maxSteps: number, revision: string): Promise<EvaluationReport> {
  const tasks: EvaluationTask[] = ['repair', 'false-answer', 'tool-failure'].map(id => ({
    id, prompt: TASK,
    judge: run => ({ passed: run.trace.includes('artifact:passed'), reason: run.trace.includes('artifact:passed')
      ? '实际文件内容与语法检查均通过' : '实际文件未满足要求，最终回答不能代替验证' }),
  }));
  return evaluate(tasks, async task => {
    const root = await mkdtemp(join(tmpdir(), 'pi-capstone-eval-'));
    try {
      await createFixture(root);
      const tools = await createWorkspaceTools(root);
      if (task.id === 'tool-failure') {
        const read = tools.find(tool => tool.definition.name === 'read_file')!;
        read.run = async () => { throw new Error('injected read failure'); };
      }
      const model: Model = task.id === 'false-answer'
        ? async () => ({ message: { role: 'assistant', content: '已经修复，所有检查通过。', toolCalls: [] }, stopReason: 'end', usage: { inputTokens: 0, outputTokens: 0 } })
        : createScriptedModel();
      const trace: string[] = [];
      let toolCalls = 0;
      const countedTools = tools.map(tool => ({ ...tool, run: async (args: unknown, signal: AbortSignal) => {
        toolCalls++;
        return tool.run(args, signal);
      } }));
      const result = await runAgent({ model, tools: countedTools, task: task.prompt, queue: new InputQueue(), signal: new AbortController().signal,
        session: openSession(join(root, '.session.jsonl')), maxSteps, systemPrompt: '固定评测，不调用网络。',
        context: { mode: 'full', maxCharacters: 12000 },
        onEvent: event => {
          if (event.type === 'tool') trace.push(`tool:${event.result.isError ? 'error' : 'ok'}`);
        } });
      const grade = await gradeFixture(root);
      trace.push(grade.passed ? 'artifact:passed' : 'artifact:failed');
      return { status: result.status === 'completed' || result.status === 'budget' || result.status === 'cancelled' ? result.status : 'error',
        answer: result.messages.findLast(message => message.role === 'assistant')?.content ?? '', modelCalls: result.steps,
        toolCalls, trace, usage: result.usage, costUsd: 0,
        ...(grade.passed ? {} : { failure: { layer: result.status === 'budget' ? 'runtime' as const : task.id === 'tool-failure' ? 'tool' as const : 'model' as const,
          reason: result.status === 'budget' ? 'Model call budget exhausted before the task was complete' : 'Fixture artifact did not pass independent grading' } }) };
    } finally { await rm(root, { recursive: true }); }
  }, { label: `capstone-${maxSteps}-steps`, revision, runKind: 'fixture', provider: 'none', model: 'scripted', configuration: { maxSteps } });
}
