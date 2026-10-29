// Run one learner lab or the independent reference checks without a shell.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { labCommand, lessons } from './course.mjs';

const [id, action = 'test'] = process.argv.slice(2);
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const ids = id === 'all' && action === 'verify' ? lessons.map(lesson => lesson.id) : [id];
  for (const lessonId of ids) {
    const args = labCommand(lessonId, action);
    const env = { ...process.env };
    delete env.PI_TUTORIAL_REFERENCE;
    if (action === 'verify') env.PI_TUTORIAL_REFERENCE = '1';
    console.log(`课 ${lessonId} · ${action === 'verify' ? '参考实现' : action === 'demo' ? '参考演示' : '学生实现'}`);
    const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
