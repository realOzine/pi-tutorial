// Repair real files, stop after the edit, then reopen the journal and finish without replaying the edit.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceTools } from '../../solutions/04-workspace-tools.ts';
import { InputQueue } from '../../solutions/06-cancellation.ts';
import { openSession } from '../../solutions/08-sessions.ts';
import { createExtensions } from '../../solutions/10-extensions.ts';
import { runAgent } from '../../solutions/12-capstone.ts';
import { createFixture, createScriptedModel, gradeFixture, TASK } from './fixture.ts';
import { createProjectExtension } from './project-extension.ts';

const root = await mkdtemp(join(tmpdir(), 'pi-capstone-'));
try {
  const workspace = join(root, 'workspace');
  await mkdir(workspace);
  await createFixture(workspace);
  const extension = createExtensions(await createWorkspaceTools(workspace), [createProjectExtension()]);
  try {
    const common = { tools: extension.tools, queue: new InputQueue(), signal: new AbortController().signal,
      systemPrompt: '课程固定模型，使用真实文件工具。', context: { mode: 'trim' as const, maxCharacters: 12000 },
      transformContext: extension.transformContext };
    const journal = join(root, 'session.jsonl');
    const before = await gradeFixture(workspace);
    const first = await runAgent({ ...common, task: TASK, model: createScriptedModel(), session: openSession(journal), maxSteps: 2 });
    const resumed = await runAgent({ ...common, model: createScriptedModel(), session: openSession(journal), maxSteps: 3 });
    const grade = await gradeFixture(workspace);
    const edits = resumed.messages.flatMap(message => message.role === 'assistant' ? message.toolCalls : []).filter(call => call.name === 'edit_file');
    assert.equal(before.passed, false);
    assert.equal(first.status, 'budget');
    assert.equal(resumed.status, 'completed');
    assert.equal(edits.length, 1);
    assert.equal(grade.passed, true);
    console.log(JSON.stringify({ origin: 'scripted-model-real-files', before, first: { status: first.status, steps: first.steps },
      resumed: { status: resumed.status, steps: resumed.steps }, editExecutions: edits.length, grade }, null, 2));
  } finally { await extension.dispose(); }
} finally { await rm(root, { recursive: true }); }
