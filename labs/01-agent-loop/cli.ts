// 运行第一课练习或参考实现，并按需导出轨迹。

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runAgentLoop } from "./loop.ts";
import { runAgentLoop as referenceLoop } from "../../solutions/01-agent-loop.ts";
import { runScenario } from "./scenarios.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      reference: { type: "boolean", default: false },
      scenario: { type: "string", default: "readme" },
      trace: { type: "string" },
    },
    allowPositionals: false,
  });
  const scenario = values.scenario;
  if (scenario !== "readme" && scenario !== "tool-error" && scenario !== "budget") {
    throw new Error("--scenario 只接受 readme、tool-error 或 budget。");
  }

  let tracePath: string | undefined;
  if (values.trace) {
    tracePath = resolve(values.trace);
    const withinArtifacts = relative(resolve("artifacts"), tracePath);
    // CLI 路径是外部输入，只允许写入教具的输出目录，避免覆盖学习者代码。
    if (!withinArtifacts || withinArtifacts.startsWith("..") || isAbsolute(withinArtifacts) || !tracePath.endsWith(".json")) {
      throw new Error("--trace 必须是 artifacts/ 目录内的 .json 文件路径；请从课程根目录运行。");
    }
  }

  const { result, trace } = await runScenario(scenario, values.reference ? referenceLoop : runAgentLoop);
  console.log(`第一课 · ${values.reference ? "参考实现" : "学生实现"} · 脚本模型（不调用 API）`);
  for (const event of trace.events) console.log(event.label);
  const last = result.messages.at(-1);
  if (last?.role === "assistant") console.log(`\n${last.content}`);
  console.log(`\n模型调用 ${result.steps} 次，结束状态：${result.status}`);
  if (tracePath) {
    await mkdir(dirname(tracePath), { recursive: true });
    await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, { flag: "wx" });
    console.log(`轨迹已保存：${tracePath}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
