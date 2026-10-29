// Exercise the public CLI in fresh processes; no key or provider is used.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('CLI stops after editing, then a new process resumes and checks without re-editing', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pi-cli-'));
  t.after(() => rm(root, { recursive: true }));
  const session = join(root, 'session.jsonl');
  const args = ['labs/12-capstone/cli.ts', '--reference', '--workspace', join(root, 'work'), '--session', session];
  const first = spawnSync(process.execPath, [...args, '--init', '--steps', '2'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /"status":"budget"/);
  const second = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /"status":"completed"/);
  assert.match(second.stdout, /exitCode=0/);
  const records = (await readFile(session, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { message: { role: string; toolCalls?: { name: string }[] } });
  assert.equal(records.flatMap(record => record.message.toolCalls ?? []).filter(call => call.name === 'edit_file').length, 1);
  const idle = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
  assert.equal(idle.status, 0, idle.stderr);
  const summary = JSON.parse(idle.stdout.trim().split('\n').at(-1)!) as { steps: number; report: string; usageComplete: boolean };
  assert.equal(summary.steps, 0); assert.equal(summary.usageComplete, true);
  const report = JSON.parse(await readFile(summary.report, 'utf8')) as { calls: unknown[] };
  assert.deepEqual(report.calls, []);
});

test('CLI rejects overwrite, internal session paths and excessive call limits', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pi-cli-limits-'));
  t.after(() => rm(root, { recursive: true }));
  const common = ['labs/12-capstone/cli.ts', '--reference', '--workspace', join(root, 'work')];
  const internal = spawnSync(process.execPath, [...common, '--session', join(root, 'work', 'session'), '--init'], { encoding: 'utf8' });
  assert.equal(internal.status, 1); assert.match(internal.stderr, /workspace 之外/);
  const limited = spawnSync(process.execPath, [...common, '--session', join(root, 'session'), '--steps', '99'], { encoding: 'utf8' });
  assert.equal(limited.status, 1); assert.match(limited.stderr, /1\.\.8/);
  const args = [...common, '--session', join(root, 'session'), '--init'];
  assert.equal(spawnSync(process.execPath, args).status, 0);
  const overwrite = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(overwrite.status, 1); assert.match(overwrite.stderr, /只接受空目录/);
});

test('invalid live configuration exits even while interactive stdin remains open', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pi-cli-config-'));
  t.after(() => rm(root, { recursive: true }));
  await mkdir(join(root, 'work'));
  const child = spawn(process.execPath, ['labs/12-capstone/cli.ts', '--reference', '--workspace', join(root, 'work'),
    '--session', join(root, 'session.jsonl'), '--live'],
  { env: { ...process.env, OPENAI_API_KEY: ' ' }, stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  const status = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  }).finally(() => clearTimeout(timer));
  assert.equal(status, 1);
  assert.match(stderr, /API key and model are required/);
});

test('an external session alias cannot redirect the journal into the tool workspace', async t => {
  const root = await mkdtemp(join(tmpdir(), 'pi-cli-alias-'));
  t.after(() => rm(root, { recursive: true }));
  const workspace = join(root, 'work'); await mkdir(workspace);
  const target = join(workspace, 'journal'); await writeFile(target, '');
  const symbolic = join(root, 'symbolic'); await symlink(target, symbolic);
  const hard = join(root, 'hard'); await link(target, hard);
  for (const session of [symbolic, hard]) {
    const result = spawnSync(process.execPath, ['labs/12-capstone/cli.ts', '--reference', '--workspace', workspace, '--session', session], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /无链接别名/);
  }
  assert.equal(await readFile(target, 'utf8'), '');
});
