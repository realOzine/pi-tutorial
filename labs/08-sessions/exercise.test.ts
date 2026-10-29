// Recovery tests use temporary files and never replay a tool as a side effect of reading history.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { projectSession as student } from "./exercise.ts";
import { openSession, projectSession as reference, recoverSession } from "../../solutions/08-sessions.ts";
import type { SessionEntry } from "./exercise.ts";

const project = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const records: SessionEntry[] = [
  { version: 1, id: "u", parentId: null, message: { role: "user", content: "edit once" } },
  { version: 1, id: "a", parentId: "u", message: { role: "assistant", content: "", toolCalls: [
    { id: "call", name: "edit", arguments: { path: "a.ts" } },
  ] } },
  { version: 1, id: "t", parentId: "a", message: { role: "tool", callId: "call", content: "edited", isError: false } },
];

test("one active branch omits the abandoned answer", () => {
  const branch: SessionEntry = { version: 1, id: "b", parentId: "u", message: { role: "assistant", content: "alternative", toolCalls: [] } };
  assert.deepEqual(project([...records, branch], "b").messages.map(m => m.content), ["edit once", "alternative"]);
});
test("unfinished side effect is reported, not fabricated as success", () => {
  const result = project(records.slice(0, 2), "a");
  assert.equal(result.status, "needs_review");
  assert.deepEqual(result.pending.map(c => c.id), ["call"]);
  assert.deepEqual(result.messages, [records[0].message]);
});
test("complete tool exchange returns a legal model history", () => {
  assert.equal(project(records, "t").status, "ready");
  assert.deepEqual(project(records, "t").messages, records.map(r => r.message));
});
test("orphan results, duplicate results, broken parents and cycles are rejected", () => {
  assert.throws(() => project([{ ...records[2], parentId: null }], "t"), /Orphan/);
  assert.throws(() => project([...records, { ...records[2], id: "again", parentId: "t" }], "again"), /duplicate/);
  assert.throws(() => project(records, "missing"), /Missing/);
  assert.throws(() => project([{ ...records[0], parentId: "u" }], "u"), /cycle/);
});
test("all results in an incomplete batch stay out of the next model request", () => {
  const assistant: SessionEntry = { ...records[1], message: { role: "assistant", content: "", toolCalls: [
    { id: "call", name: "edit", arguments: {} }, { id: "second", name: "check", arguments: {} },
  ] } };
  const result = project([records[0], assistant, records[2]], "t");
  assert.deepEqual(result.pending.map(c => c.id), ["second"]);
  assert.equal(result.messages.length, 1);
});
test("journal append, reopen and branch preserve original records", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    const file = join(dir, "session.jsonl");
    const store = openSession(file);
    const user = store.appendMessage(records[0].message);
    store.appendMessage({ role: "assistant", content: "old", toolCalls: [] });
    store.branch(user);
    store.appendMessage({ role: "assistant", content: "new", toolCalls: [] });
    const reopened = openSession(file);
    assert.equal(reopened.getEntries().length, 3);
    assert.deepEqual(reopened.project().messages.map(m => m.content), ["edit once", "new"]);
  } finally { rmSync(dir, { recursive: true }); }
});
test("partial tail needs explicit copy; original and existing destinations are protected", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    const file = join(dir, "broken.jsonl");
    const content = `${JSON.stringify(records[0])}\n{"version":1`;
    writeFileSync(file, content);
    assert.throws(() => openSession(file), /Incomplete/);
    const fixed = join(dir, "recovered.jsonl");
    assert.equal(recoverSession(file, fixed), 1);
    assert.equal(openSession(fixed).project().status, "ready");
    assert.equal(readFileSync(file, "utf8"), content);
    assert.throws(() => recoverSession(file, fixed), /EEXIST/);
  } finally { rmSync(dir, { recursive: true }); }
});
test("a corrupt completed line cannot silently disappear during recovery", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-session-"));
  try {
    const file = join(dir, "bad.jsonl");
    writeFileSync(file, `${JSON.stringify(records[0])}\n{broken}\n`);
    assert.throws(() => recoverSession(file, join(dir, "copy.jsonl")));
    writeFileSync(file, '{"version":1,"id":"x","parentId":null,"message":{"role":"user","content":7}}\n');
    assert.throws(() => openSession(file), /Invalid session/);
  } finally { rmSync(dir, { recursive: true }); }
});
