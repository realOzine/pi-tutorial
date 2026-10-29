// Run the stage-07 coding agent in a fresh course-owned directory with stdin steering.
import { lstat, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createWorkspaceTools } from "../../solutions/04-workspace-tools.ts";
import { InputQueue } from "../../solutions/06-cancellation.ts";
import { runScheduled } from "./coding-agent.ts";
import { createCodingFixtureModel } from "./coding-fixture.ts";

const { values } = parseArgs({ options: { "delay-ms": { type: "string", default: "500" }, interactive: { type: "boolean", default: false }, help: { type: "boolean", default: false } } });
if (values.help) {
  console.log("用法：node labs/07-scheduling/coding-demo.ts [--interactive] [--delay-ms 0..5000]\n离线固定模型，真实文件与语法检查；每次创建 artifacts/lesson-07-* 目录，无付费调用。\n--interactive 等待 /start（stdin 关闭也开始）；运行中支持 /steer 新要求、/follow 后续任务、/stop。\n默认立即开始，模型增量间延迟 500ms 便于观察；Ctrl-C 协作取消。");
  process.exit(0);
}
const delayMs = Number(values["delay-ms"]);
if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 5000) throw new Error("delay-ms must be 0..5000");
const artifacts = fileURLToPath(new URL("../../artifacts/", import.meta.url));
await mkdir(artifacts, { recursive: true });
const artifactInfo = await lstat(artifacts);
if (!artifactInfo.isDirectory() || artifactInfo.isSymbolicLink()) throw new Error("artifacts must be a real directory");
const workspace = await mkdtemp(join(artifacts, "lesson-07-"));
await writeFile(join(workspace, "README.md"), "Fix greeting.mjs syntax, then run the configured syntax check.\n", { flag: "wx" });
await writeFile(join(workspace, "greeting.mjs"), 'export const greeting = "hello";\nconsole.log(greeting;\n', { flag: "wx" });
const controller = new AbortController();
const queue = new InputQueue();
const input = createInterface({ input: process.stdin, terminal: false });
const log = (event: unknown) => { console.log(JSON.stringify(event)); };
let start = () => {};
const startSignal = new Promise<void>((resolve) => { start = resolve; });
input.on("line", (line) => {
  if (line === "/start") start();
  else if (line === "/stop") { controller.abort(); start(); log({ type: "input", action: "stop" }); }
  else if (line.startsWith("/steer ")) { queue.steer(line.slice(7)); log({ type: "input", action: "steer", content: line.slice(7) }); }
  else if (line.startsWith("/follow ")) { queue.followUp(line.slice(8)); log({ type: "input", action: "follow", content: line.slice(8) }); }
  else log({ type: "help", commands: ["/start", "/steer 新要求", "/follow 后续任务", "/stop"] });
});
input.on("close", () => start());
const stop = () => { controller.abort(); start(); };
process.on("SIGINT", stop);
log({ type: "workspace", path: workspace, model: "deterministic-fixture", paidRequests: 0 });
log({ type: "ready", interactive: values.interactive, commands: ["/start", "/steer 新要求", "/follow 后续任务", "/stop"] });
try {
  if (values.interactive) await startSignal;
  const result = await runScheduled({
    initialMessages: [{ role: "user", content: "读取项目，修复 greeting.mjs 的语法并检查。" }],
    systemPrompt: "只操作课程生成目录。", tools: await createWorkspaceTools(workspace),
    model: createCodingFixtureModel(delayMs, (event) => log({ type: "stream", event })),
    queue, signal: controller.signal, maxSteps: 8,
    onMessage: (message) => log({ type: "message", message }),
    onToolResult: (result) => log({ type: "tool-completed", result }),
  });
  await writeFile(join(workspace, "trace.json"), JSON.stringify({ origin: "deterministic-fixture", ...result }, null, 2), { flag: "wx" });
  log({ type: "result", status: result.status, steps: result.steps, workspace });
} finally {
  input.close();
  process.off("SIGINT", stop);
}
