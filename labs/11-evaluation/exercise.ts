// Lesson 11: report every case and distinguish task verdicts from runtime completion.
export type FailureLayer = "model" | "tool" | "context" | "runtime" | "judge";
export type EvaluationRun = {
  status: "completed" | "budget" | "cancelled" | "error";
  answer: string;
  modelCalls: number | null;
  toolCalls: number | null;
  trace: string[];
  usage?: { inputTokens: number; outputTokens: number };
  costUsd?: number;
  failure?: { layer: FailureLayer; reason: string };
};
export type Judgement = { passed: boolean; reason: string };
export type EvaluationTask = { id: string; prompt: string; judge: (run: EvaluationRun) => Judgement };
export type EvaluationMetadata = {
  label: string;
  revision: string;
  runKind: "fixture" | "live";
  provider: string;
  model: string;
  configuration: Record<string, string | number | boolean>;
};
export type EvaluationRow = { id: string; elapsedMs: number; run: EvaluationRun; judgement: Judgement };
export type EvaluationReport = {
  metadata: EvaluationMetadata;
  startedAt: string;
  rows: EvaluationRow[];
  summary: {
    total: number; passed: number; passRate: number; completed: number; completionRate: number;
    elapsedMs: number; modelCalls: number | null; toolCalls: number | null;
    usage: { inputTokens: number; outputTokens: number } | null;
    costUsd: number | null; costUnavailableReason: string | null;
  };
};
export type EvaluationRunner = (task: EvaluationTask) => Promise<EvaluationRun>;

/** Run all fixed tasks and retain failures and unknown measurements in the report. */
export async function evaluate(
  tasks: readonly EvaluationTask[], runner: EvaluationRunner, metadata: EvaluationMetadata,
): Promise<EvaluationReport> {
  void tasks; void runner; void metadata;
  throw new Error("TODO: run every case, judge outcomes, preserve failures, aggregate known metrics honestly");
}
