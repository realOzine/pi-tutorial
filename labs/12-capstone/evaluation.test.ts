// A completed loop may fail its task, so exercise the independent artifact judge.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateCapstone } from './evaluation.ts';

test('a larger call budget repairs the normal fixture but cannot hide false answers or tool failures', async () => {
  const baseline = await evaluateCapstone(1, 'test');
  const candidate = await evaluateCapstone(6, 'test');
  assert.equal(baseline.summary.passed, 0);
  assert.equal(baseline.rows.find(row => row.id === 'repair')?.run.failure?.layer, 'runtime');
  assert.equal(candidate.summary.passed, 1);
  assert.equal(candidate.summary.completed, 3);
  assert.equal(candidate.summary.costUsd, 0);
  const liar = candidate.rows.find(row => row.id === 'false-answer')!;
  assert.equal(liar.run.status, 'completed');
  assert.equal(liar.judgement.passed, false);
  assert.match(liar.run.answer, /所有检查通过/);
  assert.equal(candidate.rows.find(row => row.id === 'tool-failure')?.judgement.passed, false);
});
