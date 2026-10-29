// Integration evidence must include files, restart, uncertainty and context gates, not only happy-path messages.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { Model, Tool } from '../shared/contracts.ts';
import type { AgentOptions } from './exercise.ts';
import { runAgent as student } from './exercise.ts';
import { runAgent as reference } from '../../solutions/12-capstone.ts';
import { createWorkspaceTools } from '../../solutions/04-workspace-tools.ts';
import { InputQueue } from '../../solutions/06-cancellation.ts';
import { openSession } from '../../solutions/08-sessions.ts';
import { createExtensions } from '../../solutions/10-extensions.ts';
import { createFixture, createScriptedModel, gradeFixture, TASK } from './fixture.ts';
import { createProjectExtension } from './project-extension.ts';

const run = process.env.PI_TUTORIAL_REFERENCE === '1' ? reference : student;
const finalModel: Model = async () => ({ message: { role: 'assistant', content: 'done', toolCalls: [] }, stopReason: 'end', usage: { inputTokens: 1, outputTokens: 1 } });

async function environment(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'pi-integration-'));
  t.after(() => rm(root, { recursive: true }));
  const workspace = join(root, 'workspace'); await mkdir(workspace); await createFixture(workspace);
  const journal = join(root, 'session.jsonl');
  const tools = await createWorkspaceTools(workspace);
  const options: AgentOptions = { session: openSession(journal), tools, model: createScriptedModel(), queue: new InputQueue(),
    signal: new AbortController().signal, systemPrompt: '课程 fixture', maxSteps: 5, context: { mode: 'full', maxCharacters: 12000 } };
  return { root, workspace, journal, options };
}

test('real file repair survives reopen and executes edit exactly once', async t => {
  const env = await environment(t);
  assert.equal((await gradeFixture(env.workspace)).passed, false);
  const first = await run({ ...env.options, task: TASK, maxSteps: 2 });
  assert.equal(first.status, 'budget');
  const resumed = await run({ ...env.options, session: openSession(env.journal), model: createScriptedModel() });
  assert.equal(resumed.status, 'completed');
  assert.equal((await gradeFixture(env.workspace)).passed, true);
  assert.equal(resumed.messages.flatMap(m => m.role === 'assistant' ? m.toolCalls : []).filter(c => c.name === 'edit_file').length, 1);
  assert(resumed.messages.some(m => m.role === 'tool' && m.content.includes('exitCode=0')));
});

test('unresolved intent prevents model requests and survives a new task attempt', async t => {
  const env = await environment(t);
  env.options.session.appendMessage({ role: 'user', content: TASK });
  env.options.session.appendMessage({ role: 'assistant', content: '', toolCalls: [{ id: 'uncertain', name: 'edit_file', arguments: {} }] });
  const before = await readFile(env.journal, 'utf8'); let calls = 0;
  const result = await run({ ...env.options, session: openSession(env.journal), task: 'try again', model: async (...args) => { calls++; return finalModel(...args); } });
  assert.equal(result.status, 'needs_review'); assert.equal(calls, 0);
  assert.equal(await readFile(env.journal, 'utf8'), before);
});

test('context rejection preserves full history and starts no paid work', async t => {
  const env = await environment(t); let calls = 0;
  const result = await run({ ...env.options, task: 'x'.repeat(500), context: { mode: 'trim', maxCharacters: 50 }, model: async (...args) => { calls++; return finalModel(...args); } });
  assert.equal(result.status, 'context_limit'); assert.equal(calls, 0);
  assert.equal(env.options.session.project().messages[0].content.length, 500);
});

test('extension tool and context hook work, and disabling extension leaves the core runnable', async t => {
  for (const enabled of [true, false]) {
    const env = await environment(t);
    const extension = createExtensions(env.options.tools, [{ ...createProjectExtension(), enabled }]);
    try {
      let sawContext = false;
      const model = createScriptedModel();
      const result = await run({ ...env.options, task: TASK, tools: extension.tools, transformContext: extension.transformContext,
        model: async (request, signal) => { sawContext ||= request.messages.some(m => m.content.includes('项目背景')); return model(request, signal); } });
      assert.equal(result.status, 'completed'); assert.equal((await gradeFixture(env.workspace)).passed, true);
      assert.equal(sawContext, enabled);
      assert.equal(result.messages.some(m => m.role === 'assistant' && m.toolCalls.some(c => c.name === 'project_info')), enabled);
      assert(!result.messages.some(m => m.content.includes('项目背景')));
    } finally { await extension.dispose(); }
  }
});

test('cancelled side effect leaves uncertainty rather than replayable false success', async t => {
  const env = await environment(t); const controller = new AbortController(); let writes = 0;
  const tool: Tool = { definition: { name: 'write', description: '', parameters: {} }, execution: 'sequential', validate: () => {},
    run: async () => { writes++; controller.abort(); return 'effect happened'; } };
  const model: Model = async () => ({ message: { role: 'assistant', content: '', toolCalls: [{ id: 'write-once', name: 'write', arguments: {} }] },
    stopReason: 'tool_calls', usage: { inputTokens: 1, outputTokens: 1 } });
  const result = await run({ ...env.options, task: 'write', tools: [tool], model, signal: controller.signal });
  assert.equal(result.status, 'cancelled'); assert.equal(writes, 1);
  assert.equal(openSession(env.journal).project().status, 'needs_review');
  const resumed = await run({ ...env.options, session: openSession(env.journal), model, tools: [tool] });
  assert.equal(resumed.status, 'needs_review'); assert.equal(writes, 1);
});

test('steering and follow-up each reach a later request while the journal stays paired', async t => {
  const env = await environment(t); const queue = new InputQueue(); let calls = 0; const tails: string[] = [];
  const result = await run({ ...env.options, task: 'first', queue, model: async (request, signal) => {
    tails.push(request.messages.at(-1)?.content ?? '');
    if (++calls === 1) { queue.steer('use Chinese'); queue.followUp('summarize later'); }
    return finalModel(request, signal);
  } });
  assert.equal(result.status, 'completed');
  assert.deepEqual(tails, ['first', 'use Chinese', 'summarize later']);
  assert.equal(openSession(env.journal).project().status, 'ready');
});

test('truncated calls are recorded as not executed and never change files', async t => {
  const env = await environment(t); let effects = 0;
  const tool: Tool = { definition: { name: 'effect', description: '', parameters: {} }, execution: 'sequential', validate: () => {}, run: async () => { effects++; return 'bad'; } };
  const result = await run({ ...env.options, task: 'test', tools: [tool], model: async () => ({ message: { role: 'assistant', content: '', toolCalls: [{ id: 'partial', name: 'effect', arguments: {} }] }, stopReason: 'length', usage: { inputTokens: 2, outputTokens: 3 } }) });
  assert.equal(result.status, 'truncated'); assert.equal(effects, 0);
  assert.equal(openSession(env.journal).project().status, 'ready');
  assert.equal(result.messages.at(-1)?.role, 'tool');
});

test('observer cancellation before a request incurs no model call', async t => {
  const env = await environment(t); const controller = new AbortController(); let calls = 0;
  const result = await run({ ...env.options, task: 'test', signal: controller.signal,
    onEvent: event => { if (event.type === 'request') controller.abort(); },
    model: async (...args) => { calls++; return finalModel(...args); } });
  assert.equal(result.status, 'cancelled'); assert.equal(result.steps, 0); assert.equal(calls, 0);
});

test('restoring a completed conversation does not start another autonomous run', async t => {
  const env = await environment(t);
  await run({ ...env.options, task: 'hello', model: finalModel }); let calls = 0;
  const result = await run({ ...env.options, session: openSession(env.journal), model: async (...args) => { calls++; return finalModel(...args); } });
  assert.equal(result.status, 'completed'); assert.equal(calls, 0);
});
