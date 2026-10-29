// Render macro architecture, local flow, state transitions and design choices without external libraries.
import { components, overviewEdges, lessonDiagrams, validateLessonDiagram, diagramStep } from './architecture-data.mjs';
import { layoutNodes, diagramSize, routeDiagram } from './architecture-geometry.mjs';

const SVG = 'http://www.w3.org/2000/svg';
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const svgElement = (tag, attributes = {}, text) => {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};

function graph(id, authoredNodes, edges, title, overview = false) {
  const nodes = layoutNodes(authoredNodes);
  const size = diagramSize(nodes);
  const wrapper = element('div', undefined, 'architecture-scroll');
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', `${title}，窄屏可横向滚动`);
  const svg = svgElement('svg', { viewBox: `0 0 ${size.width} ${size.height}`, role: 'img', 'aria-labelledby': `${id}-title ${id}-description`, class: 'architecture-svg' });
  svg.style.minWidth = `${Math.min(size.width, overview ? 800 : 640)}px`;
  svg.append(svgElement('title', { id: `${id}-title` }, title));
  svg.append(svgElement('desc', { id: `${id}-description` }, edges.map(edge => `${nodes.find(node => node.id === edge.from).label} ${edge.both ? '↔' : '→'} ${nodes.find(node => node.id === edge.to).label}：${edge.label}`).join('；')));
  const defs = svgElement('defs');
  for (const active of [false, true]) {
    const marker = svgElement('marker', { id: `${id}-arrow${active ? '-active' : ''}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' });
    marker.append(svgElement('path', { d: 'M 1 1 L 9 5 L 1 9 Z', class: active ? 'architecture-arrow active' : 'architecture-arrow' }));
    defs.append(marker);
  }
  svg.append(defs);
  if (overview) {
    const localWidth = nodes.find(node => node.id === 'model').x + 180 + 8;
    const resourceX = nodes.find(node => node.id === 'provider').x - 10;
    for (const group of [
      { x: 8, y: 8, width: localWidth - 8, height: size.height - 40, label: '本地 Node 宿主 · 框内为函数模块' },
      { x: resourceX, y: 8, width: size.width - resourceX - 8, height: nodes.find(node => node.id === 'storage').y + 86, label: '外部服务 / 进程 / 磁盘' },
    ]) {
      svg.append(svgElement('rect', { x: group.x, y: group.y, width: group.width, height: group.height, rx: 8, class: 'architecture-boundary' }));
      svg.append(svgElement('text', { x: group.x + 12, y: group.y + 20, class: 'architecture-boundary-label' }, group.label));
    }
  }
  const routes = routeDiagram(nodes, edges);
  const edgeNodes = new Map();
  const edgeKeys = element('ol', undefined, 'architecture-edge-key');
  for (const [index, edge] of edges.entries()) {
    const route = routes[index];
    const group = svgElement('g', { class: `architecture-edge${edge.observation ? ' observation' : ''}` });
    const path = svgElement('path', { d: route.points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '), 'marker-end': `url(#${id}-arrow)`, fill: 'none' });
    if (edge.both) path.setAttribute('marker-start', `url(#${id}-arrow)`);
    group.append(path);
    if (route.label) {
      const label = route.label;
      group.append(svgElement('rect', { ...label, rx: 3, class: 'architecture-edge-label-bg' }));
      group.append(svgElement('text', { x: label.x + label.width / 2, y: label.y + 14, 'text-anchor': 'middle', class: 'architecture-edge-label' }, edge.label));
    } else {
      const a = route.points[0], b = route.points[1];
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      group.append(svgElement('circle', { cx: x, cy: y, r: 10, class: 'architecture-edge-label-bg' }));
      group.append(svgElement('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'architecture-edge-label' }, String(index + 1)));
      const key = element('li', `${index + 1} · ${nodes.find(node => node.id === edge.from).label} ${edge.both ? '↔' : '→'} ${nodes.find(node => node.id === edge.to).label}：${edge.label}`);
      key.dataset.edge = edge.id; edgeKeys.append(key);
    }
    svg.append(group); edgeNodes.set(edge.id, { group, path, edge });
  }
  const nodeElements = new Map();
  for (const node of nodes) {
    const group = svgElement('g', { class: 'architecture-node' });
    group.append(svgElement('rect', { x: node.x, y: node.y, width: node.width, height: node.height, rx: 6 }));
    group.append(svgElement('text', { x: node.x + node.width / 2, y: node.y + 25, 'text-anchor': 'middle', class: 'architecture-node-title' }, node.label));
    group.append(svgElement('text', { x: node.x + node.width / 2, y: node.y + 48, 'text-anchor': 'middle', class: 'architecture-node-note' }, node.note));
    svg.append(group); nodeElements.set(node.id, group);
  }
  wrapper.append(svg);
  const figure = element('figure', undefined, 'architecture-figure');
  figure.append(wrapper);
  if (edgeKeys.children.length) figure.append(edgeKeys);
  let showAllEdges = !overview;
  let highlightedEdges = [];
  const visibility = () => {
    for (const [edgeId, { group }] of edgeNodes) group.style.display = showAllEdges || highlightedEdges.includes(edgeId) ? '' : 'none';
    for (const key of edgeKeys.children) key.hidden = !showAllEdges && !highlightedEdges.includes(key.dataset.edge);
  };
  return { figure, showAll(value) { showAllEdges = value; visibility(); }, highlight(nodeIds, edgeIds) {
    highlightedEdges = edgeIds; visibility();
    for (const [nodeId, node] of nodeElements) node.classList.toggle('active', nodeIds.includes(nodeId));
    for (const [edgeId, { group, path, edge }] of edgeNodes) {
      const active = edgeIds.includes(edgeId);
      group.classList.toggle('active', active);
      path.setAttribute('marker-end', `url(#${id}-arrow${active ? '-active' : ''})`);
      if (edge.both) path.setAttribute('marker-start', `url(#${id}-arrow${active ? '-active' : ''})`);
    }
  } };
}

for (const host of document.querySelectorAll('[data-architecture]')) {
  try {
    const lesson = validateLessonDiagram(lessonDiagrams.find(item => item.id === host.dataset.architecture));
    const prefix = `atlas-${lesson.id}`;
    host.classList.add('architecture-atlas');
    host.append(element('p', lesson.location, 'architecture-location'));
    host.append(element('p', lesson.summary));
    host.append(element('h3', '1 · 这一课在完整架构的哪里'));
    host.append(element('p', `本课关注：${lesson.focus.map(id => components.find(node => node.id === id).label).join('、')}。图中组件位置在各课保持一致。`, 'architecture-current'));
    const overview = graph(`${prefix}-overview`, components, overviewEdges, '课程完整架构与本课位置', true);
    const focusEdges = overviewEdges.filter(edge => lesson.focus.includes(edge.from) && lesson.focus.includes(edge.to)).map(edge => edge.id);
    overview.highlight(lesson.focus, focusEdges);
    const showAllLabel = element('label', undefined, 'architecture-edge-toggle');
    const showAll = element('input'); showAll.type = 'checkbox';
    showAll.addEventListener('change', () => overview.showAll(showAll.checked));
    showAllLabel.append(showAll, document.createTextNode(' 显示全部组件关系'));
    host.append(element('p', '绿色框定位本课。默认显示本课相关连线；选择组件可查看它与其他部分的联系。大图在窄屏可横向滚动。', 'quiet'), showAllLabel);
    host.append(overview.figure);
    const controls = element('div', undefined, 'architecture-inspector');
    const label = element('label', '查看组件职责 ');
    const select = element('select');
    select.append(new Option('本课新增与尚未展开', 'lesson'));
    for (const component of components) select.append(new Option(component.label, component.id));
    label.append(select);
    const description = element('div'); description.setAttribute('aria-live', 'polite');
    const inspect = () => {
      description.replaceChildren();
      if (select.value === 'lesson') {
        overview.highlight(lesson.focus, focusEdges);
        description.append(element('p', `本课新增 / 深入：${lesson.added}`), element('p', `尚未展开 / 保持为边界：${lesson.deferred}`));
      } else {
        const component = components.find(node => node.id === select.value);
        overview.highlight([component.id], overviewEdges.filter(edge => edge.from === component.id || edge.to === component.id).map(edge => edge.id));
        description.append(element('p', component.role));
        const source = element('a', '在 Zed 打开对应源码'); source.href = `zed://file${component.source}`;
        description.append(element('p', `相关课程：${component.lessons}。`), source);
      }
    };
    select.addEventListener('change', inspect); inspect();
    controls.append(label, description); host.append(controls);
    host.append(element('p', '这是课程的职责总览：本地函数调用、网络、磁盘和检查子进程分别标出。pi 的包和函数提供阅读映射，但此图不宣称每个框都是 pi 的独立包，也不表示本课已实现所有框。评测在循环之外运行。', 'quiet'));

    host.append(element('h3', `2 · 放大本课：${lesson.flow.title}`), element('p', lesson.flow.caption));
    const local = graph(`${prefix}-flow`, lesson.flow.nodes, lesson.flow.edges, lesson.flow.title);
    host.append(local.figure);
    const panel = element('div', undefined, 'architecture-step'); panel.setAttribute('aria-live', 'polite');
    const title = element('h4'); const explanation = element('p'); const active = element('p', undefined, 'quiet');
    panel.append(title, explanation, active); host.append(panel);
    const buttons = element('div', undefined, 'architecture-controls');
    const previous = element('button', '上一步'); previous.type = 'button';
    const next = element('button', '下一步'); next.type = 'button';
    const reset = element('button', '从头观察'); reset.type = 'button';
    const positionLabel = element('span', undefined, 'quiet');
    buttons.append(previous, next, reset, positionLabel); host.append(buttons);
    host.append(element('h3', '3 · 这一步，数据发生了什么变化'));
    const changes = element('div', undefined, 'architecture-changes'); changes.setAttribute('aria-live', 'polite');
    host.append(changes);
    let position = 0;
    const update = () => {
      const selected = diagramStep(lesson, position); position = selected.index;
      const step = selected.step;
      local.highlight(step.nodes, step.edges);
      title.textContent = `${position + 1}. ${step.title}`; explanation.textContent = step.explanation;
      active.textContent = `当前关注：${step.nodes.map(id => lesson.flow.nodes.find(node => node.id === id).label).join('、')}`;
      positionLabel.textContent = `${position + 1} / ${lesson.flow.steps.length}`;
      previous.disabled = position === 0; next.disabled = position === lesson.flow.steps.length - 1;
      changes.replaceChildren();
      for (const change of step.changes) {
        const card = element('div', undefined, 'architecture-change');
        card.append(element('h4', change.name));
        const before = element('div', undefined, 'architecture-value'); before.append(element('span', '变化前'), element('code', change.before));
        const after = element('div', undefined, 'architecture-value after'); after.append(element('span', '变化后'), element('code', change.after));
        const arrow = element('span', '↓', 'architecture-state-arrow'); arrow.setAttribute('aria-hidden', 'true');
        card.append(before, arrow, after); changes.append(card);
      }
    };
    previous.addEventListener('click', () => { position--; update(); });
    next.addEventListener('click', () => { position++; update(); });
    reset.addEventListener('click', () => { position = 0; update(); });
    update();

    host.append(element('h3', '4 · 把架构选择和代价放在一起看'));
    const tradeoff = element('figure', undefined, 'architecture-tradeoff');
    tradeoff.append(element('figcaption', lesson.tradeoff.decision));
    const choices = element('div', undefined, 'architecture-choices');
    for (const [name, choice] of [['课程选择', lesson.tradeoff.chosen], ['另一条路径', lesson.tradeoff.alternative]]) {
      const card = element('div', undefined, 'architecture-choice');
      card.append(element('p', name, 'quiet'), element('h4', choice.title), element('p', `得到：${choice.benefit}`), element('p', `付出：${choice.cost}`));
      choices.append(card);
    }
    tradeoff.append(choices, element('p', `何时改变：${lesson.tradeoff.boundary}`, 'architecture-decision'));
    host.append(tradeoff);
  } catch (error) {
    const failure = element('p', `图示暂不可用：${error.message}`); failure.setAttribute('role', 'alert'); host.append(failure);
  }
}
