import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as student from './exercise.ts';
import * as reference from '../../solutions/00-typescript.ts';

const implementation = process.env.PI_TUTORIAL_REFERENCE === '1' ? reference : student;

test('role narrows the available message fields', () => {
  assert.equal(implementation.describeMessage({ role: 'user', content: '读文件' }), '用户：读文件');
  assert.equal(implementation.describeMessage({ role: 'assistant', content: '开始', toolNames: ['read'] }), '助手：开始；工具数=1');
  assert.equal(implementation.describeMessage({ role: 'tool', callId: 'a', content: '不存在', isError: true }), '工具 a：失败；不存在');
});

test('await returns the eventual value, preserving the exact signal', async () => {
  const signal = new AbortController().signal;
  const result = await implementation.runOperation(async received => { assert.equal(received, signal); return 'README'; }, signal);
  assert.deepEqual(result, { status: 'completed', value: 'README' });
});

test('catch handles Error objects and non-Error throws', async () => {
  const signal = new AbortController().signal;
  for (const error of [new Error('missing'), 'missing']) {
    assert.deepEqual(await implementation.runOperation(async () => { throw error; }, signal), { status: 'failed', error: 'missing' });
  }
});

test('an already cancelled operation never starts', async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await implementation.runOperation(async () => { calls++; return 'bad'; }, controller.signal), { status: 'cancelled' });
  assert.equal(calls, 0);
});

test('cancellation cannot undo a side effect in an uncooperative operation', async () => {
  const controller = new AbortController();
  let sideEffect = false;
  const result = await implementation.runOperation(async () => { controller.abort(); sideEffect = true; return 'done'; }, controller.signal);
  assert.deepEqual(result, { status: 'cancelled' });
  assert.equal(sideEffect, true);
});

test('a cooperative operation can reject when its signal is cancelled', async () => {
  const controller = new AbortController();
  const result = await implementation.runOperation(async signal => { controller.abort(); signal.throwIfAborted(); return 'unreachable'; }, controller.signal);
  assert.deepEqual(result, { status: 'cancelled' });
});
