// Validate authored scenarios and keep the selected step inside its bounds.
export function parseWalkthrough(text) {
  const value = JSON.parse(text);
  if (!value || !Array.isArray(value.scenarios) || value.scenarios.length < 2) throw new Error('演示至少需要两个情境');
  const ids = new Set();
  for (const scenario of value.scenarios) {
    if (typeof scenario.id !== 'string' || ids.has(scenario.id) || typeof scenario.label !== 'string') throw new Error('情境名称或标识不合法');
    ids.add(scenario.id);
    if (!Array.isArray(scenario.steps) || scenario.steps.length < 2) throw new Error('每个情境至少需要两步');
    for (const step of scenario.steps) {
      if (!step || typeof step.title !== 'string' || typeof step.detail !== 'string' || !Object.hasOwn(step, 'state')) throw new Error('步骤缺少说明或状态');
    }
  }
  return value.scenarios;
}

export function selectStep(scenarios, scenarioId, index) {
  const scenario = scenarios.find(entry => entry.id === scenarioId);
  if (!scenario || !Number.isInteger(index)) throw new Error('无效的演示位置');
  const position = Math.max(0, Math.min(index, scenario.steps.length - 1));
  return { scenario, position, step: scenario.steps[position] };
}
