// A fixed project-status capability and a context reminder, both registered outside the core loop.
import type { Extension } from "./exercise.ts";

/** Create a deterministic teaching extension; its tool has no filesystem or network side effects. */
export function createProjectExtension(): Extension {
  return {
    name: "project-notes",
    tools: [{
      definition: { name: "project_info", description: "返回课程示例项目约束", parameters: { type: "object", properties: {}, additionalProperties: false } },
      execution: "parallel",
      validate(arguments_) {
        if (typeof arguments_ !== "object" || arguments_ === null || Array.isArray(arguments_) || Object.keys(arguments_).length) {
          throw new Error("project_info takes an empty object");
        }
      },
      async run(_, signal) {
        signal.throwIfAborted();
        return "示例项目：保留端口 8080；修改后运行受控检查。";
      },
    }],
    async beforeModel(messages, signal) {
      signal.throwIfAborted();
      return [{ role: "user", content: "项目提醒（派生上下文）：最终回答说明执行过哪些检查。" }, ...messages];
    },
  };
}
