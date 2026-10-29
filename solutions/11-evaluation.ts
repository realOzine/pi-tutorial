// Sequential fixed-case evaluation; unknown call counts and costs never become zero by default.
import { performance } from "node:perf_hooks";
import type { EvaluationMetadata, EvaluationReport, EvaluationRow, EvaluationRun, EvaluationRunner, EvaluationTask, Judgement } from "../labs/11-evaluation/exercise.ts";

/** Evaluate every task with independent verdicts and preserve runner or judge failures. */
export async function evaluate(
  tasks: readonly EvaluationTask[], runner: EvaluationRunner, metadata: EvaluationMetadata,
): Promise<EvaluationReport> {
  if (!tasks.length) throw new Error("Evaluation requires at least one task");
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) throw new Error("Duplicate evaluation task id");
  const startedAt = new Date().toISOString();
  const rows: EvaluationRow[] = [];
  for (const task of tasks) {
    const start = performance.now();
    let run: EvaluationRun;
    try { run = await runner(task); }
    catch (error) {
      run = {
        status: "error", answer: "", modelCalls: null, toolCalls: null, trace: [],
        failure: { layer: "runtime", reason: error instanceof Error ? error.message : String(error) },
      };
    }
    const elapsedMs = performance.now() - start;
    let judgement: Judgement;
    try { judgement = task.judge(run); }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      judgement = { passed: false, reason: `Judge failed: ${reason}` };
      // Keep the run untouched: a broken judge is not evidence that the agent itself failed.
    }
    rows.push({ id: task.id, elapsedMs, run, judgement });
  }
  const passed = rows.filter(row => row.judgement.passed).length;
  const completed = rows.filter(row => row.run.status === "completed").length;
  const costs = rows.map(row => row.run.costUsd);
  const modelCalls = rows.map(row => row.run.modelCalls);
  const toolCalls = rows.map(row => row.run.toolCalls);
  const usages = rows.map(row => row.run.usage);
  return {
    metadata, startedAt, rows,
    summary: {
      total: rows.length, passed, passRate: passed / rows.length, completed, completionRate: completed / rows.length,
      elapsedMs: rows.reduce((sum, row) => sum + row.elapsedMs, 0),
      modelCalls: modelCalls.every(value => value !== null) ? modelCalls.reduce((sum, value) => sum + value, 0) : null,
      toolCalls: toolCalls.every(value => value !== null) ? toolCalls.reduce((sum, value) => sum + value, 0) : null,
      usage: usages.every(value => value !== undefined)
        ? usages.reduce((sum, value) => ({ inputTokens: sum.inputTokens + value.inputTokens, outputTokens: sum.outputTokens + value.outputTokens }), { inputTokens: 0, outputTokens: 0 })
        : null,
      costUsd: costs.every(value => value !== undefined) ? costs.reduce((sum, value) => sum + value, 0) : null,
      costUnavailableReason: costs.some(value => value === undefined) ? "At least one case has no provider-priced cost measurement" : null,
    },
  };
}
