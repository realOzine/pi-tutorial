// A scripted model fixes a real temporary project using the same loop and tool protocol.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceTools } from "../../solutions/04-workspace-tools.ts";
import { runMvp } from "../03-model-adapter/mvp.ts";
import type { Model, ToolCall } from "../shared/contracts.ts";

const root = await mkdtemp(join(tmpdir(), "pi-course-coding-"));
try {
  await writeFile(join(root, "greeting.mjs"), 'export const greeting = "hello"\nconsole.log(greeting;\n');
  const plan: ToolCall[] = [
    { id: "read-1", name: "read_file", arguments: { path: "greeting.mjs" } },
    { id: "edit-1", name: "edit_file", arguments: { path: "greeting.mjs", oldText: "console.log(greeting;", newText: "console.log(greeting);" } },
    { id: "check-1", name: "check_file", arguments: { path: "greeting.mjs" } },
  ];
  let step = 0;
  const model: Model = async (request) => {
    const last = request.messages.at(-1);
    if (last?.role === "tool" && last.isError) throw new Error(`Demo tool failed: ${last.content}`);
    const call = plan[step++];
    return { message: { role: "assistant", content: call ? `执行 ${call.name}` : "已修复括号，语法检查通过。",
      toolCalls: call ? [call] : [] }, usage: { inputTokens: 0, outputTokens: 0 }, stopReason: call ? "tool_calls" : "end" };
  };
  const result = await runMvp({ model, tools: await createWorkspaceTools(root),
    messages: [{ role: "user", content: "修复 greeting.mjs 的语法错误并检查。" }], systemPrompt: "先读文件，再精确编辑，最后检查。", maxSteps: 5, signal: new AbortController().signal });
  console.log(JSON.stringify({ origin: "scripted-model-with-real-files-and-node-check", ...result,
    finalFile: await readFile(join(root, "greeting.mjs"), "utf8") }, null, 2));
} finally { await rm(root, { recursive: true, force: true }); }
