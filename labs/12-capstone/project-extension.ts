// One trusted, statically imported extension supplies project context and a custom read-only tool.
import type { Extension } from '../10-extensions/exercise.ts';

/** Create a removable project extension without changing the agent loop. */
export function createProjectExtension(): Extension {
  return {
    name: 'tutorial-project',
    beforeModel: async (messages, signal) => {
      signal.throwIfAborted();
      return [{ role: 'user', content: '项目背景（补充资料）：请用最小修改修复语法，区分语法检查通过与功能已验证。' }, ...messages];
    },
    tools: [{
      definition: { name: 'project_info', description: 'Read the tutorial project acceptance rules',
        parameters: { type: 'object', properties: {}, additionalProperties: false } },
      execution: 'parallel',
      validate: args => {
        if (args === null || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length) throw new Error('Expected empty arguments object');
      },
      run: async (_args, signal) => { signal.throwIfAborted(); return '修复 greeting.mjs 的结束反引号；保留 Hello, ${name}!；运行 check_file。'; },
    }],
  };
}
