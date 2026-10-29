// One stable overview lets learners locate each lesson before reading its local implementation.
import { foundationDiagrams } from './diagram-data-foundations.mjs';
import { runtimeDiagrams } from './diagram-data-runtime.mjs';
import { stateDiagrams } from './diagram-data-state.mjs';

const pi = '/Users/ozine/Project/learn/pi/';
const course = '/Users/ozine/Project/learn/pi-tutorial/';
export const components = [
  { id: 'input', label: '输入与交互', note: 'CLI / 用户队列', col: 0, row: 0, role: '接收任务、引导与停止。排队不等于立刻请求模型。', lessons: '01、06、07', source: `${pi}packages/agent/src/agent.ts:308:1` },
  { id: 'loop', label: '运行循环', note: '本轮做完再决定下一轮', col: 1, row: 0, role: '编排模型、工具和停止条件。模型输出请求，宿主执行请求。', lessons: '01、06、12', source: `${pi}packages/agent/src/agent-loop.ts:172:1` },
  { id: 'model', label: '模型适配', note: '消息映射 / 流式事件', col: 2, row: 0, role: '将课程消息转换为供应商协议，把完整响应交回循环。增量预览尚未提交。', lessons: '00、03、05', source: `${course}labs/05-streaming/openai.ts:1:1` },
  { id: 'provider', label: '远端模型服务', note: '独立网络服务', col: 3, row: 0, role: '通过 HTTPS 接收上下文并返回文本或工具请求，不直接执行本机文件工具。', lessons: '03、05、12', source: `${course}solutions/03-model-adapter.ts:1:1` },
  { id: 'extensions', label: '资源与扩展', note: '指令 / hook / 工具注册', col: 0, row: 1, role: '在明确接入点改变请求视图或可用能力。进程内扩展是可信代码，不是权限隔离。', lessons: '10', source: `${pi}packages/coding-agent/src/core/extensions/runner.ts:1:1` },
  { id: 'context', label: '上下文视图', note: '本次请求看见哪些记录', col: 1, row: 1, role: '从完整消息生成请求视图。课程的字符预算不等于精确 token 数；裁剪视图不会删除日志。', lessons: '09、10', source: `${course}solutions/09-context.ts:1:1` },
  { id: 'tools', label: '工具执行', note: '校验 → 调度 → 收集结果', col: 2, row: 1, role: '检查模型提出的参数，执行允许的工具，保留 callId 与失败信息。并行完成顺序不一定是请求顺序。', lessons: '02、04、07', source: `${pi}packages/agent/src/agent-loop.ts:518:1` },
  { id: 'workspace', label: '文件与检查器', note: '磁盘 / Node 子进程', col: 3, row: 1, role: '文件操作改变真实内容；check_file 启动 node --check，只验证语法。这里没有 OS sandbox。', lessons: '04、07、12', source: `${course}labs/04-workspace-tools/workspace.ts:1:1` },
  { id: 'session', label: '会话管理', note: '记录 / 分支 / 恢复投影', col: 0, row: 2, role: '课程实现持久化消息并重建当前分支。只有请求、没有结果时保留未知状态，不自动重放副作用。', lessons: '08、12', source: `${course}solutions/08-sessions.ts:1:1` },
  { id: 'storage', label: '会话文件', note: 'JSONL 持久记录', col: 3, row: 2, role: '磁盘记录在重启后仍存在，但记录请求与文件副作用不是一个原子事务。', lessons: '08、12', source: `${course}solutions/08-sessions.ts:1:1` },
  { id: 'evaluation', label: '独立评测', note: '循环外的任务判定', col: 1, row: 3, role: '用任务判定器检查实际结果。课程中可与循环在同一进程运行；独立指判定标准，不能把 completed 当作 passed。', lessons: '11、12', source: `${course}labs/12-capstone/evaluation.ts:1:1` },
];

export const overviewEdges = [
  { id: 'input-loop', from: 'input', to: 'loop', label: '用户消息 / 控制信号' },
  { id: 'loop-model', from: 'loop', to: 'model', label: '请求 / 完整响应', both: true },
  { id: 'model-provider', from: 'model', to: 'provider', label: 'HTTPS / SSE', both: true },
  { id: 'loop-tools', from: 'loop', to: 'tools', label: '调用 / 工具结果', both: true },
  { id: 'tools-workspace', from: 'tools', to: 'workspace', label: '文件 I/O / 子进程', both: true },
  { id: 'extensions-context', from: 'extensions', to: 'context', label: '指令 / context hook' },
  { id: 'extensions-tools', from: 'extensions', to: 'tools', label: '注册工具' },
  { id: 'session-context', from: 'session', to: 'context', label: '完整消息投影' },
  { id: 'context-model', from: 'context', to: 'model', label: '请求视图' },
  { id: 'loop-session', from: 'loop', to: 'session', label: '持久化消息' },
  { id: 'session-storage', from: 'session', to: 'storage', label: 'JSONL 文件 I/O', both: true },
  { id: 'evaluation-workspace', from: 'evaluation', to: 'workspace', label: '读取实际产物判定', observation: true },
];

export const lessonDiagrams = [...foundationDiagrams, ...runtimeDiagrams, ...stateDiagrams];

/** Validate authored lesson diagrams before rendering or checking the course. */
export function validateLessonDiagram(lesson) {
  if (!/^\d{2}$/.test(lesson.id) || !lesson.focus.length || lesson.focus.some(id => !components.some(node => node.id === id))) throw new Error('Invalid lesson focus');
  for (const key of ['location', 'summary', 'added', 'deferred']) if (typeof lesson[key] !== 'string' || !lesson[key].trim()) throw new Error(`Missing ${key}`);
  const { nodes, edges, steps } = lesson.flow;
  if (nodes.length < 2 || nodes.length > 8 || steps.length < 3 || steps.length > 5) throw new Error('Invalid diagram size');
  if (new Set(nodes.map(node => node.id)).size !== nodes.length || new Set(nodes.map(node => `${node.col}:${node.row}`)).size !== nodes.length) throw new Error('Duplicate diagram node or position');
  if (nodes.some(node => !Number.isInteger(node.col) || node.col < 0 || node.col > 2 || !Number.isInteger(node.row) || node.row < 0 || node.row > 2 || !node.label || !node.note)) throw new Error('Invalid diagram node');
  if (new Set(edges.map(edge => edge.id)).size !== edges.length) throw new Error('Duplicate diagram edge');
  for (const edge of edges) if (!edge.label || !nodes.some(node => node.id === edge.from) || !nodes.some(node => node.id === edge.to)) throw new Error('Invalid edge endpoint');
  for (const step of steps) {
    if (!step.title || !step.explanation || step.nodes.some(id => !nodes.some(node => node.id === id)) || step.edges.some(id => !edges.some(edge => edge.id === id))) throw new Error('Invalid step reference');
    if (step.changes.length < 2 || step.changes.length > 3 || step.changes.some(change => ['name', 'before', 'after'].some(key => typeof change[key] !== 'string'))) throw new Error('Invalid data transition');
  }
  const tradeoff = lesson.tradeoff;
  if (!tradeoff.decision || !tradeoff.boundary || [tradeoff.chosen, tradeoff.alternative].some(choice => !choice.title || !choice.benefit || !choice.cost)) throw new Error('Missing architectural trade-off');
  return lesson;
}

export function diagramStep(lesson, position) {
  if (!Number.isInteger(position)) throw new Error('Invalid step index');
  const index = Math.max(0, Math.min(position, lesson.flow.steps.length - 1));
  return { index, step: lesson.flow.steps[index] };
}
