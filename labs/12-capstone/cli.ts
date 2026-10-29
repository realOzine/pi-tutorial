// A bounded local CLI: fixture by default, explicit live streaming, and durable conversation outside the tool workspace.
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { createWorkspaceTools } from '../../solutions/04-workspace-tools.ts';
import { createStreamingOpenAIModel } from '../05-streaming/openai.ts';
import { InputQueue } from '../../solutions/06-cancellation.ts';
import { openSession } from '../../solutions/08-sessions.ts';
import { createExtensions } from '../../solutions/10-extensions.ts';
import { runAgent as reference } from '../../solutions/12-capstone.ts';
import { runAgent as student } from './exercise.ts';
import { createFixture, createScriptedModel, gradeFixture, TASK } from './fixture.ts';
import { createProjectExtension } from './project-extension.ts';
import type { Model } from '../shared/contracts.ts';

const usage = `用法：node labs/12-capstone/cli.ts --reference --workspace DIR --session FILE [选项]
  --init                 在空目录建立语法修复任务，并开始任务
  --task TEXT            新任务；省略则恢复未完成的会话
  --steps 1..8           本次模型调用上限，默认 6
  --context 128..24000   请求视图字符上限，默认 12000；超限保留原日志
  --no-extension        关闭示例扩展；其余功能仍可运行
  --live --key-file FILE 使用 gpt-6.1-terra 真实流式 API（会付费）
                         也可通过 OPENAI_API_KEY 提供密钥
运行期间输入 /steer TEXT、/follow TEXT、/stop；Ctrl-C 也会取消。
默认使用固定规则模型。省略 --reference 会运行你编写的 runAgent。`;

try {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log(usage); }
  else {
    const flags = new Set(['--reference', '--init', '--live', '--no-extension']);
    const values = new Set(['--workspace', '--session', '--task', '--steps', '--context', '--key-file']);
    const options = new Map<string, string>();
    for (let i = 0; i < args.length; i++) {
      const name = args[i];
      if (options.has(name)) throw new Error(`重复参数：${name}`);
      if (flags.has(name)) options.set(name, 'true');
      else if (values.has(name) && args[i + 1] && !args[i + 1].startsWith('--')) options.set(name, args[++i]);
      else throw new Error(`无效参数：${name}\n${usage}`);
    }
    if (!options.has('--workspace') || !options.has('--session')) throw new Error(usage);
    const steps = Number(options.get('--steps') ?? 6);
    const maxCharacters = Number(options.get('--context') ?? 12000);
    if (!Number.isInteger(steps) || steps < 1 || steps > 8) throw new Error('--steps 必须在 1..8');
    if (!Number.isInteger(maxCharacters) || maxCharacters < 128 || maxCharacters > 24000) throw new Error('--context 必须在 128..24000');
    const requestedWorkspace = resolve(options.get('--workspace')!);
    if (options.has('--init')) await mkdir(requestedWorkspace, { recursive: true });
    const workspace = await realpath(requestedWorkspace);
    const requestedSession = resolve(options.get('--session')!);
    await mkdir(dirname(requestedSession), { recursive: true });
    const sessionPath = resolve(await realpath(dirname(requestedSession)), requestedSession.split(sep).at(-1)!);
    const inside = (path: string) => { const part = relative(workspace, path); return !part || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part)); };
    if (inside(sessionPath)) throw new Error('会话文件必须放在工具 workspace 之外');
    try {
      const existing = await lstat(sessionPath);
      if (!existing.isFile() || existing.nlink !== 1) throw new Error('会话文件必须是无链接别名的普通文件');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    if (options.has('--init')) {
      if ((await readdir(workspace)).length) throw new Error('--init 只接受空目录，避免覆盖已有文件');
      await createFixture(workspace);
    }
    let key = process.env.OPENAI_API_KEY ?? '';
    if (options.has('--key-file')) {
      if (!options.has('--live')) throw new Error('--key-file 只能用于显式 --live');
      const keyPath = await realpath(resolve(options.get('--key-file')!));
      if (inside(keyPath)) throw new Error('密钥文件不能位于工具 workspace 内');
      const secret = await readFile(keyPath, 'utf8');
      key = secret.match(/\bsk-[A-Za-z0-9_-]+/)?.[0] ?? secret.trim();
    }
    if (options.has('--live') && !key) throw new Error('--live 需要 --key-file 或 OPENAI_API_KEY');
    const session = openSession(sessionPath);
    const calls: { status: 'started' | 'completed' | 'unknown'; inputTokens?: number; outputTokens?: number }[] = [];
    const reportPath = `${sessionPath}.${randomUUID()}.run.json`;
    let previews = 0;
    const live = options.has('--live');
    const persist = async () => writeFile(reportPath, JSON.stringify({ origin: live ? 'live-openai-stream' : 'scripted-model', model: live ? 'gpt-6.1-terra' : 'fixture', calls, previews,
      usageComplete: calls.every(call => call.status === 'completed') }, null, 2), { mode: 0o600 });
    const underlying = live ? createStreamingOpenAIModel({ apiKey: key, model: 'gpt-6.1-terra', maxOutputTokens: 512, timeoutMs: 30000 }, event => {
      if (event.type === 'preview') { previews++; process.stdout.write('.'); }
    }) : createScriptedModel();
    // Validate the provider before opening interactive input, which would otherwise keep a failed CLI alive.
    const runtime = createExtensions(await createWorkspaceTools(workspace), options.has('--no-extension') ? [] : [createProjectExtension()]);
    const queue = new InputQueue();
    const controller = new AbortController();
    const stop = () => controller.abort(new Error('用户取消'));
    process.on('SIGINT', stop);
    const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
    input.on('line', line => {
      if (line === '/stop') stop();
      else if (line.startsWith('/steer ')) queue.steer(line.slice(7));
      else if (line.startsWith('/follow ')) queue.followUp(line.slice(8));
      else console.error('支持 /steer TEXT、/follow TEXT、/stop');
    });
    const model: Model = async (request, signal) => {
      if (calls.length >= steps || Buffer.byteLength(JSON.stringify(request)) > 24000) throw new Error('请求达到本次调用次数或 24 KB 输入限制');
      const call: typeof calls[number] = { status: 'started' };
      calls.push(call);
      await persist();
      try {
        const response = await underlying(request, signal);
        Object.assign(call, response.usage, { status: 'completed' });
        await persist();
        return response;
      } catch (error) { call.status = 'unknown'; await persist(); throw error; }
    };
    try {
      await persist();
      console.log(live ? '真实模型：gpt-6.1-terra；最多 8 次，每次最多 512 输出 tokens；无自动重试。' : '固定规则模型 + 真实文件工具；不产生模型费用。');
      const run = options.has('--reference') ? reference : student;
      const result = await run({ model, tools: runtime.tools, session, queue, signal: controller.signal,
        task: options.get('--task') ?? (options.has('--init') ? TASK : undefined), maxSteps: steps,
        systemPrompt: '你是本地课程编码助手。先阅读文件，再做最小修改；完成后调用 check_file。只声明实际完成的检查。',
        context: { mode: 'trim', maxCharacters }, transformContext: runtime.transformContext,
        onEvent: event => {
          if (event.type === 'tool') console.log(`\n[tool ${event.result.callId}] ${event.result.isError ? 'error' : 'ok'}: ${event.result.content}`);
          if (event.type === 'response' && event.response.message.content) console.log(`\n${event.response.message.content}`);
        } });
      console.log(JSON.stringify({ status: result.status, steps: result.steps, knownUsage: result.usage,
        usageComplete: calls.every(call => call.status === 'completed'), previews, session: sessionPath, report: reportPath }));
      if (options.has('--init')) console.log(JSON.stringify({ fixtureGrade: await gradeFixture(workspace) }));
      if (result.status !== 'completed' && result.status !== 'budget') process.exitCode = 2;
    } finally {
      input.close(); process.stdin.pause(); process.removeListener('SIGINT', stop);
      await runtime.dispose();
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : '运行失败');
  process.exitCode = 1;
}
