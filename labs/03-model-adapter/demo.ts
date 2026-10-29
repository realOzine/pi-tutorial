// An offline default demo; the explicit --live route makes the same loop call OpenAI.
import { parseArgs } from "node:util";
import { createOpenAIModel } from "../../solutions/03-model-adapter.ts";
import { createMemoryReadTool } from "../02-tool-protocol/fixtures.ts";
import { runMvp } from "./mvp.ts";
import type { Model } from "../shared/contracts.ts";

const { values } = parseArgs({ options: { live: { type: "boolean", default: false } } });
const live = values.live;
let model: Model;
if (live) {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_MODEL;
  if (!apiKey || !modelName) throw new Error("--live requires OPENAI_API_KEY and OPENAI_MODEL; never put keys in HTML or Git");
  model = createOpenAIModel({ apiKey, model: modelName, maxOutputTokens: 256 });
} else {
  model = async (request) => {
    const result = request.messages.findLast((message) => message.role === "tool");
    return { message: { role: "assistant", content: result ? `启动命令：${result.content}` : "先读取说明。",
      toolCalls: result ? [] : [{ id: "read-1", name: "read_file", arguments: { path: "README.md" } }] },
      usage: { inputTokens: 0, outputTokens: 0 }, stopReason: result ? "end" : "tool_calls" };
  };
}
const result = await runMvp({ model, tools: [createMemoryReadTool(new Map([["README.md", "npm run dev"]]))],
  messages: [{ role: "user", content: "读取 README.md，告诉我启动命令。必须使用 read_file 获取内容。" }],
  systemPrompt: "只依据工具结果回答。不要编造文件内容。", maxSteps: 3, signal: new AbortController().signal });
console.log(JSON.stringify({ origin: live ? "openai-responses-live" : "reference-scripted-model", ...result }, null, 2));
