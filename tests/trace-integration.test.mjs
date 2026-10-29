import assert from "node:assert/strict";
import { test } from "node:test";
import { runScenario } from "../labs/01-agent-loop/scenarios.ts";
import { runAgentLoop } from "../solutions/01-agent-loop.ts";
import { getStep, parseTrace } from "../site/assets/simulator.mjs";

test("the HTML viewer accepts actual lab traces without changing their messages", async () => {
  for (const scenario of ["readme", "tool-error", "budget"]) {
    const { result, trace } = await runScenario(scenario, runAgentLoop);
    const imported = parseTrace(JSON.stringify(trace));
    const final = getStep(imported, imported.events.length - 1);
    assert.equal(final.requests, result.steps, scenario);
    assert.equal(final.atEnd, true, scenario);
    assert.deepEqual(final.event.messages, result.messages, scenario);
    assert.ok(final.event.label.startsWith(result.status), scenario);
  }
});
