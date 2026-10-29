// Run the reference exercise without a model or filesystem side effects.
import { describeMessage, runOperation } from '../../solutions/00-typescript.ts';

console.log(describeMessage({ role: 'assistant', content: '我要读 README', toolNames: ['read_file'] }));
console.log(await runOperation(async () => 'README 内容', new AbortController().signal));
console.log(await runOperation(async () => { throw '文件不存在'; }, new AbortController().signal));
const controller = new AbortController();
console.log(await runOperation(async () => { controller.abort(); return '虽然返回了，取消仍优先'; }, controller.signal));
