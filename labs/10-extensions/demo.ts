// Exercise the same extension-enabled request assembly with and without the plugin.
import { composeInstructions, createExtensions } from "../../solutions/10-extensions.ts";
import { createProjectExtension } from "./example.ts";

for (const enabled of [false, true]) {
  const runtime = createExtensions([], [{ ...createProjectExtension(), enabled }]);
  try {
    const signal = new AbortController().signal;
    const messages = await runtime.transformContext([{ role: "user", content: "检查项目" }], signal);
    console.log(JSON.stringify({ enabled, tools: runtime.tools.map(tool => tool.definition.name), messages }, null, 2));
    for (const tool of runtime.tools) {
      tool.validate({});
      console.log("工具实际返回：", await tool.run({}, signal));
    }
  } finally { await runtime.dispose(); }
}
console.log(composeInstructions("你是项目助手。", "使用项目约定的检查方式。", [{ name: "review", description: "需要评阅时加载" }]));
