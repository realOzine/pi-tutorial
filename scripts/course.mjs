// One ordered inventory for course checks and lab commands.
export const lessons = [
  ['00', 'typescript', '必要的 TypeScript'],
  ['01', 'agent-loop', '最小 Agent 循环'],
  ['02', 'tool-protocol', '工具协议与失败反馈'],
  ['03', 'model-adapter', '接入真实模型'],
  ['04', 'workspace-tools', '构建 coding 工具'],
  ['05', 'streaming', '流式输出与事件'],
  ['06', 'cancellation', '中断与用户介入'],
  ['07', 'scheduling', '多工具调度'],
  ['08', 'sessions', '会话与恢复'],
  ['09', 'context', '上下文管理'],
  ['10', 'extensions', '指令与扩展'],
  ['11', 'evaluation', '评测与可靠性'],
  ['12', 'capstone', '整合项目与架构答辩'],
].map(([id, slug, title]) => ({ id, slug, title, directory: `${id}-${slug}` }));

export function labCommand(id, action) {
  const lesson = lessons.find((entry) => entry.id === id);
  if (!lesson || !['test', 'verify', 'demo'].includes(action)) {
    throw new Error('用法：npm run lab -- 00..12 test|verify|demo');
  }
  const path = `labs/${lesson.directory}/`;
  if (action === 'demo') return [path + (id === '01' ? 'cli.ts' : 'demo.ts'), ...(id === '01' ? ['--reference'] : [])];
  return ['--test', path + (id === '01' ? 'loop.test.ts' : 'exercise.test.ts')];
}
