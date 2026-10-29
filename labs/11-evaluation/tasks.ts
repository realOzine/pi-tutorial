// Fixed local failure injections and evidence probes; these do not call or benchmark an LLM.
import { setTimeout as delay } from "node:timers/promises";
import { selectContext } from "../../solutions/09-context.ts";
import { createProjectExtension } from "../10-extensions/example.ts";
import type { Message } from "../shared/contracts.ts";
import type { EvaluationRun, EvaluationRunner, EvaluationTask } from "./exercise.ts";

export const TASKS: readonly EvaluationTask[] = [
  { id: "retain-port", prompt: "旧约束要求端口8080；大量日志后再问端口", judge: run => ({ passed: run.status === "completed" && run.answer === "8080", reason: "答案必须精确为8080，不能靠出现一个关键词通过" }) },
  { id: "bad-arguments", prompt: "向无参工具传入未知参数", judge: run => ({ passed: run.status === "error" && run.failure?.layer === "tool" && run.toolCalls === 0, reason: "执行前拒绝参数，不发生工具执行" }) },
  { id: "oversized-turn", prompt: "当前轮次输出超过预算", judge: run => ({ passed: run.status === "budget" && run.modelCalls === 0, reason: "停止请求，不把不完整工具交互硬裁后发送" }) },
  { id: "timeout", prompt: "请求等待超过本地时限", judge: run => ({ passed: run.status === "error" && run.failure?.layer === "model" && run.trace.includes("timeout observed"), reason: "记录超时，不把它标成completed" }) },
  { id: "cancel", prompt: "在下一次请求前取消", judge: run => ({ passed: run.status === "cancelled" && run.modelCalls === 0, reason: "取消后不启动模型请求" }) },
];

/** Run identical fixtures; only the old-history policy differs between the two candidates. */
export function createFixtureRunner(mode: "trim" | "summary"): EvaluationRunner {
  return async task => {
    const base: EvaluationRun = { status: "completed", answer: "", modelCalls: 0, toolCalls: 0, trace: [] };
    if (task.id === "retain-port") {
      const history: Message[] = [
        { role: "user", content: "必须保留端口8080" },
        { role: "assistant", content: "日志".repeat(500), toolCalls: [] },
        { role: "user", content: "端口是多少" },
      ];
      const view = await selectContext(history, { mode, maxCharacters: 280 }, async old => old[0].content);
      return { ...base, answer: view.messages.some(message => message.content.includes("8080")) ? "8080" : "unknown", trace: [`context:${mode}`, `characters:${view.characters}`, "rule-based evidence probe; no LLM"] };
    }
    if (task.id === "bad-arguments") {
      const tool = createProjectExtension().tools![0];
      try { tool.validate({ unexpected: true }); }
      catch (error) { return { ...base, status: "error", failure: { layer: "tool", reason: error instanceof Error ? error.message : String(error) }, trace: ["validate rejected; run not called"] }; }
      throw new Error("Fixture expected invalid arguments to be rejected");
    }
    if (task.id === "oversized-turn") {
      const view = await selectContext([{ role: "user", content: "x".repeat(500) }], { mode, maxCharacters: 100 }, async () => "short");
      return { ...base, status: view.status === "over_budget" ? "budget" : "completed", failure: { layer: "context", reason: "current turn exceeds character budget" }, trace: [`context:${view.status}`] };
    }
    if (task.id === "timeout") {
      const signal = AbortSignal.timeout(5);
      try { await delay(100, undefined, { signal }); }
      catch {
        if (!signal.aborted) throw new Error("Unexpected timer failure");
        return { ...base, status: "error", failure: { layer: "model", reason: "simulated provider wait exceeded timeout" }, trace: ["local cancellable timer; no network", "timeout observed"] };
      }
      throw new Error("Timeout fixture unexpectedly completed");
    }
    if (task.id === "cancel") {
      const controller = new AbortController();
      controller.abort(new Error("user stopped"));
      try { await selectContext([{ role: "user", content: "hi" }], { mode: "full", maxCharacters: 100 }, undefined, controller.signal); }
      catch {
        if (!controller.signal.aborted) throw new Error("Unexpected cancellation failure");
        return { ...base, status: "cancelled", trace: ["abort observed before request"] };
      }
      throw new Error("Cancellation fixture unexpectedly completed");
    }
    throw new Error(`Unknown fixed task: ${task.id}`);
  };
}
