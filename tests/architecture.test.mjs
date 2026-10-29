import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { lessons } from '../scripts/course.mjs';
import { components, overviewEdges, lessonDiagrams, validateLessonDiagram, diagramStep } from '../site/assets/architecture-data.mjs';
import { layoutNodes, routeDiagram, segmentHitsBox } from '../site/assets/architecture-geometry.mjs';

test('all thirteen lessons locate their scope and provide complete state transitions and trade-offs', async () => {
  assert.deepEqual(lessonDiagrams.map(lesson => lesson.id), lessons.map(lesson => lesson.id));
  for (const lesson of lessonDiagrams) {
    validateLessonDiagram(lesson);
    const page = await readFile(new URL(`../site/lessons/${lessons.find(item => item.id === lesson.id).directory}.html`, import.meta.url), 'utf8');
    assert(page.includes(`data-architecture="${lesson.id}"`));
    assert(page.includes('src="../assets/architecture.mjs"'));
    assert(page.includes('href="../assets/architecture.css"'));
    assert(page.indexOf('id="atlas"') < page.indexOf('id="problem"') || lesson.id === '01');
  }
});

test('diagram data rejects broken references, overlapping nodes and missing explanations', () => {
  const lesson = lessonDiagrams[0];
  const invalid = structuredClone(lesson);
  invalid.flow.steps[0].edges.push('missing');
  assert.throws(() => validateLessonDiagram(invalid));
  const overlap = structuredClone(lesson);
  Object.assign(overlap.flow.nodes[1], { col: overlap.flow.nodes[0].col, row: overlap.flow.nodes[0].row });
  assert.throws(() => validateLessonDiagram(overlap));
  assert.throws(() => validateLessonDiagram({ ...lesson, added: '' }));
  assert.throws(() => validateLessonDiagram({ ...lesson, focus: ['invented-module'] }));
});

test('all overview and local arrows route around component boxes and keep labels clear', () => {
  for (const flow of [{ nodes: components, edges: overviewEdges }, ...lessonDiagrams.map(lesson => lesson.flow)]) {
    const nodes = layoutNodes(flow.nodes);
    const routes = routeDiagram(nodes, flow.edges);
    const labels = routes.map(route => route.label).filter(Boolean);
    for (const [index, edge] of flow.edges.entries()) {
      const route = routes[index];
      for (let i = 1; i < route.points.length; i++) {
        for (const box of [...nodes, ...labels]) assert.equal(segmentHitsBox(route.points[i - 1], route.points[i], box), false, `${edge.id} crosses a node or label`);
      }
      if (route.label) {
        for (const node of nodes) {
          const a = route.label;
          assert(!(a.x < node.x + node.width && a.x + a.width > node.x && a.y < node.y + node.height && a.y + a.height > node.y), `${edge.id} label covers ${node.id}`);
        }
      }
    }
  }
});

test('first and last diagram steps stay bounded and reset selects the original data', () => {
  for (const lesson of lessonDiagrams) {
    assert.equal(diagramStep(lesson, -1).index, 0);
    assert.equal(diagramStep(lesson, 1000).index, lesson.flow.steps.length - 1);
    assert.equal(diagramStep(lesson, 0).step, lesson.flow.steps[0]);
    assert.throws(() => diagramStep(lesson, NaN));
  }
});

test('interactive source links open final local code positions rather than temporary worktrees', async () => {
  for (const component of components) {
    const match = /^(.+):(\d+):(\d+)$/.exec(component.source);
    assert(match); assert(!match[1].includes('/.worktrees/'));
    const lines = (await readFile(match[1], 'utf8')).split('\n');
    assert(Number(match[2]) <= lines.length);
    assert(Number(match[3]) <= lines[Number(match[2]) - 1].length + 1);
  }
});
