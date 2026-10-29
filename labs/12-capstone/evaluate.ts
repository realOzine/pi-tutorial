// Save two reproducible configurations; these fixtures are protocol tests, not model benchmarks.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { evaluateCapstone } from './evaluation.ts';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
const revision = `${head}${dirty ? '-dirty' : ''}`;
if (dirty) console.error('工作区有未提交内容：报告标记 dirty，不能只靠 commit 重现这次运行。');
await mkdir('artifacts/capstone-evaluation', { recursive: true });
for (const steps of [1, 6]) {
  const report = await evaluateCapstone(steps, revision);
  const path = `artifacts/capstone-evaluation/${steps}-steps.json`;
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ path, ...report.summary }));
}
