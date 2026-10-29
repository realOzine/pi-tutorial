// Compare one change against fixed probes; stdout is a report, not an LLM leaderboard.
import { evaluate } from "../../solutions/11-evaluation.ts";
import { createFixtureRunner, TASKS } from "./tasks.ts";

for (const strategy of ["trim", "summary"] as const) {
  const report = await evaluate(TASKS, createFixtureRunner(strategy), {
    label: strategy === "trim" ? "baseline" : "candidate",
    revision: process.env.COURSE_REVISION ?? "working-tree (not pinned)",
    runKind: "fixture", provider: "none", model: "rule-based evidence probe",
    configuration: { strategy, dataset: "course-five-cases-v1", repeats: 1 },
  });
  console.log(JSON.stringify(report, null, 2));
}
