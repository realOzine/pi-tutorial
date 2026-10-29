// A tiny syntax-repair task; the scripted model is a deterministic protocol fixture, not an LLM.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Model, ToolCall } from '../shared/contracts.ts';

export const BROKEN = 'export const greeting = (name) => `Hello, ${name}!;\n';
export const FIXED = 'export const greeting = (name) => `Hello, ${name}!`;\n';
export const TASK = '读取 README.md 与 greeting.mjs，修复 greeting.mjs 的语法错误，运行 check_file 检查，再解释实际修改。';

/** Populate an explicitly chosen empty exercise directory without overwriting files. */
export async function createFixture(root: string): Promise<void> {
  await writeFile(join(root, 'README.md'), 'greeting.mjs 应导出 greeting(name)，返回 Hello, 加上名字和感叹号。当前有一处语法错误。\n', { flag: 'wx' });
  await writeFile(join(root, 'greeting.mjs'), BROKEN, { flag: 'wx' });
}

/** Choose fixed tool calls according to previous fixture results; no language understanding is claimed. */
export function createScriptedModel(): Model {
  let sequence = 0;
  const runId = randomUUID();
  return async (request, signal) => {
    signal.throwIfAborted();
    const lastUser = request.messages.findLastIndex(message => message.role === 'user');
    const current = request.messages.slice(lastUser + 1);
    const assistant = current.findLast(message => message.role === 'assistant');
    const previousTools = assistant?.role === 'assistant' ? assistant.toolCalls.map(call => call.name) : [];
    const results = current.filter(message => message.role === 'tool');
    let calls: Omit<ToolCall, 'id'>[] = [];
    let content = '';
    if (results.some(message => message.isError)) content = '工具失败，任务未完成；请查看错误结果。';
    else if (previousTools.includes('check_file')) content = '已补齐模板字符串的结束反引号。check_file 返回 exitCode=0；这只证明语法检查通过。';
    else if (previousTools.includes('edit_file')) calls = [{ name: 'check_file', arguments: { path: 'greeting.mjs' } }];
    else if (previousTools.includes('read_file')) calls = [{ name: 'edit_file', arguments: { path: 'greeting.mjs', oldText: BROKEN, newText: FIXED } }];
    else {
      calls = ['README.md', 'greeting.mjs'].map(path => ({ name: 'read_file', arguments: { path } }));
      if (request.tools.some(tool => tool.name === 'project_info')) calls.push({ name: 'project_info', arguments: {} });
    }
    return { message: { role: 'assistant', content, toolCalls: calls.map(call => ({ ...call, id: `fixture-${runId}-${++sequence}` })) },
      stopReason: calls.length ? 'tool_calls' : 'end', usage: { inputTokens: 0, outputTokens: 0 } };
  };
}

/** Verify the artifact independently of the model's final answer, without executing its code. */
export async function gradeFixture(root: string): Promise<{ passed: boolean; exactContent: boolean; syntaxPassed: boolean }> {
  const content = await readFile(join(root, 'greeting.mjs'), 'utf8');
  const checked = spawnSync(process.execPath, ['--check', join(root, 'greeting.mjs')], { timeout: 5000, maxBuffer: 8192, env: {} });
  const exactContent = content === FIXED;
  const syntaxPassed = checked.status === 0;
  return { passed: exactContent && syntaxPassed, exactContent, syntaxPassed };
}
