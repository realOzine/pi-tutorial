// Supply deterministic incremental model output for a real file-editing exercise.
import { setTimeout } from "node:timers/promises";
import { consumeStream } from "../../solutions/05-streaming.ts";
import type { StreamListener, StreamPart } from "../05-streaming/exercise.ts";
import type { Model, ToolCall } from "../shared/contracts.ts";

/** Return a fixed model that reads, repairs one known syntax error, checks, then answers. */
export function createCodingFixtureModel(delayMs: number, onEvent: StreamListener): Model {
  return async (request, signal) => {
    const completed = new Set(request.messages.filter((message) => message.role === "tool").map((message) => message.callId));
    let calls: ToolCall[] = [];
    let text: string;
    if (!completed.has("read-main")) {
      text = "先并行读取项目说明和源文件。";
      calls = [{ id: "read-main", name: "read_file", arguments: { path: "greeting.mjs" } }, { id: "read-readme", name: "read_file", arguments: { path: "README.md" } }];
    } else if (!completed.has("edit-main")) {
      text = "精确修复已知括号错误，再检查语法。";
      calls = [{ id: "edit-main", name: "edit_file", arguments: { path: "greeting.mjs", oldText: "console.log(greeting;", newText: "console.log(greeting);" } }, { id: "check-main", name: "check_file", arguments: { path: "greeting.mjs" } }];
    } else {
      const check = request.messages.find((message) => message.role === "tool" && message.callId === "check-main");
      const latestInput = request.messages.filter((message) => message.role === "user").at(-1)?.content ?? "";
      text = check?.role === "tool" && !check.isError ? `语法检查通过。当前输入：${latestInput}` : "检查未通过，请阅读工具错误；固定模型不自动猜测其他修改。";
    }
    async function* stream(): AsyncGenerator<StreamPart> {
      yield { type: "text", delta: text };
      await setTimeout(delayMs, undefined, { signal });
      for (const call of calls) {
        yield { type: "tool-start", id: call.id, name: call.name };
        const args = JSON.stringify(call.arguments);
        const split = Math.floor(args.length / 2);
        yield { type: "tool-delta", id: call.id, delta: args.slice(0, split) };
        await setTimeout(delayMs, undefined, { signal });
        yield { type: "tool-delta", id: call.id, delta: args.slice(split) };
      }
      yield { type: "finish", stopReason: calls.length ? "tool_calls" : "end", usage: { inputTokens: 0, outputTokens: 0 } };
    }
    return consumeStream(stream(), signal, onEvent);
  };
}
