// Demonstrate protocol feedback without reading files or contacting a provider.
import { executeResponseTools } from "../../solutions/02-tool-protocol.ts";
import { createMemoryReadTool } from "./fixtures.ts";
import type { ModelResponse } from "../shared/contracts.ts";

const tools = [createMemoryReadTool(new Map([["README.md", "npm run dev"]]))];
for (const scenario of ["valid", "wrong-path-type", "truncated"] as const) {
  const response: ModelResponse = {
    message: { role: "assistant", content: "", toolCalls: [{ id: "call-1", name: "read_file",
      arguments: { path: scenario === "wrong-path-type" ? [] : "README.md" } }] },
    usage: { inputTokens: 0, outputTokens: 0 }, stopReason: scenario === "truncated" ? "length" : "tool_calls",
  };
  console.log(JSON.stringify({ origin: "reference-with-scripted-response", scenario,
    results: await executeResponseTools(response, tools, new AbortController().signal) }, null, 2));
}
