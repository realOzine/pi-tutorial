// Run parallel reads and an ordered edit/check against an explicit in-memory coding fixture.
import { setTimeout } from "node:timers/promises";
import { executeToolCall } from "../../solutions/02-tool-protocol.ts";
import { executeBatch } from "../../solutions/07-scheduling.ts";
import type { Tool, ToolCall } from "../shared/contracts.ts";

const files = new Map([["README.md", "Run npm run dev"], ["config.json", '{"port":3000}']]);
const tools: Tool[] = [
  { definition: { name: "read", description: "Read fixture file", parameters: {} }, execution: "parallel",
    validate: (value) => { if (typeof value !== "string" || !files.has(value)) throw new Error("Known fixture path required"); },
    run: async (value, signal) => { await setTimeout(value === "README.md" ? 80 : 20, undefined, { signal }); return files.get(String(value)) ?? ""; } },
  { definition: { name: "edit", description: "Apply fixed fixture edit", parameters: {} }, execution: "sequential", validate: () => {},
    run: async (_value, signal) => { signal.throwIfAborted(); files.set("config.json", '{"port":4173}'); return "port updated"; } },
  { definition: { name: "check", description: "Check fixture port", parameters: {} }, execution: "parallel", validate: () => {},
    run: async (_value, signal) => { signal.throwIfAborted(); if (files.get("config.json") !== '{"port":4173}') throw new Error("unexpected port"); return "check passed"; } },
];
const batches: ToolCall[][] = [
  [{ id: "r1", name: "read", arguments: "README.md" }, { id: "r2", name: "read", arguments: "config.json" }],
  [{ id: "w1", name: "edit", arguments: {} }, { id: "c1", name: "check", arguments: {} }],
];
console.log("固定内存项目；延迟仅为观察顺序，不是性能基准；没有模型 API。");
for (const batch of batches) {
  const values = await executeBatch(batch, tools, new AbortController().signal, {
    execute: executeToolCall,
    onResult: (value) => { console.log("完成事件", value.callId, value.content); },
  });
  console.log("模型收到的结果顺序", values.map((value) => value.callId));
}
