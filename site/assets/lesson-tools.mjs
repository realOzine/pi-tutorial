// Render course walkthroughs using text nodes, never executable imported HTML.
import { parseWalkthrough, selectStep } from './walkthrough.mjs';

for (const host of document.querySelectorAll('[data-walkthrough]')) {
  const scenarios = parseWalkthrough(host.querySelector('.walkthrough-data').textContent);
  let scenarioId = scenarios[0].id;
  let position = 0;
  const toolbar = document.createElement('div');
  toolbar.className = 'sim-toolbar';
  const label = document.createElement('label');
  label.textContent = '选择情境 ';
  const select = document.createElement('select');
  for (const scenario of scenarios) {
    const option = document.createElement('option');
    option.value = scenario.id;
    option.textContent = scenario.label;
    select.append(option);
  }
  label.append(select);
  const badge = document.createElement('span');
  badge.className = 'quiet';
  badge.textContent = '教学模拟 · 不代表实际运行或计时';
  toolbar.append(label, badge);
  const panel = document.createElement('div');
  panel.className = 'sim-panel';
  panel.setAttribute('aria-live', 'polite');
  const heading = document.createElement('h3');
  const detail = document.createElement('p');
  const state = document.createElement('pre');
  panel.append(heading, detail, state);
  const actions = document.createElement('div');
  actions.className = 'sim-actions';
  const previous = document.createElement('button');
  previous.type = 'button'; previous.textContent = '上一步';
  const next = document.createElement('button');
  next.type = 'button'; next.textContent = '下一步';
  const reset = document.createElement('button');
  reset.type = 'button'; reset.textContent = '重新开始';
  const count = document.createElement('span');
  count.className = 'quiet';
  actions.append(previous, next, reset, count);
  host.append(toolbar, panel, actions);
  const render = () => {
    const selected = selectStep(scenarios, scenarioId, position);
    position = selected.position;
    heading.textContent = selected.step.title;
    detail.textContent = selected.step.detail;
    state.textContent = JSON.stringify(selected.step.state, null, 2);
    count.textContent = `${position + 1} / ${selected.scenario.steps.length}`;
    previous.disabled = position === 0;
    next.disabled = position === selected.scenario.steps.length - 1;
  };
  select.addEventListener('change', () => { scenarioId = select.value; position = 0; render(); });
  previous.addEventListener('click', () => { position -= 1; render(); });
  next.addEventListener('click', () => { position += 1; render(); });
  reset.addEventListener('click', () => { position = 0; render(); });
  render();
}
