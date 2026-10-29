import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labCommand, lessons } from '../scripts/course.mjs';
import { parseWalkthrough, selectStep } from '../site/assets/walkthrough.mjs';

test('the lab inventory covers 00 through 12 and rejects arbitrary commands', () => {
  assert.equal(lessons.length, 13);
  assert.deepEqual(labCommand('01', 'demo'), ['labs/01-agent-loop/cli.ts', '--reference']);
  assert.deepEqual(labCommand('02', 'verify'), ['--test', 'labs/02-tool-protocol/exercise.test.ts']);
  assert.throws(() => labCommand('../secret', 'demo'));
  assert.throws(() => labCommand('02', 'shell'));
});

test('walkthroughs clamp steps and reject broken scenario data', () => {
  const scenarios = parseWalkthrough(JSON.stringify({ scenarios: ['normal', 'failure'].map(id => ({ id, label: id, steps: [0, 1].map(n => ({ title: `${n}`, detail: 'why', state: { n } })) })) }));
  assert.equal(selectStep(scenarios, 'normal', -1).position, 0);
  assert.equal(selectStep(scenarios, 'failure', 50).position, 1);
  assert.throws(() => selectStep(scenarios, 'missing', 0));
  assert.throws(() => parseWalkthrough('{bad'));
  assert.throws(() => parseWalkthrough('{"scenarios":[]}'));
});
