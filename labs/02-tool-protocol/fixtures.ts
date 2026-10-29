// A small schema and matching runtime validator for an in-memory read tool.
import type { Tool } from "../shared/contracts.ts";

export function readPath(arguments_: unknown): string {
  if (typeof arguments_ !== "object" || arguments_ === null || Array.isArray(arguments_) ||
      !("path" in arguments_) || typeof arguments_.path !== "string" || arguments_.path.length === 0 ||
      Object.keys(arguments_).some((key) => key !== "path")) {
    throw new Error("Expected exactly { path: non-empty string }");
  }
  return arguments_.path;
}

export function createMemoryReadTool(files: ReadonlyMap<string, string>): Tool {
  return {
    definition: { name: "read_file", description: "Read one file from the lesson's memory map",
      parameters: { type: "object", properties: { path: { type: "string", minLength: 1 } }, required: ["path"], additionalProperties: false } },
    execution: "parallel",
    validate: (args) => { readPath(args); },
    run: async (args, signal) => {
      signal.throwIfAborted();
      const path = readPath(args);
      const content = files.get(path);
      if (content === undefined) throw new Error(`File not found: ${path}`);
      return content;
    },
  };
}
