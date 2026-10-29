// Each filesystem test owns a disposable directory; no test touches the learner's project.
import assert from "node:assert/strict";
import { chmod, link, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import * as student from "./exercise.ts";
import * as reference from "../../solutions/04-workspace-tools.ts";
import { executeToolCall } from "../../solutions/02-tool-protocol.ts";
import { runSyntaxCheck } from "./workspace.ts";
import type { Tool } from "../shared/contracts.ts";

const api = process.env.PI_TUTORIAL_REFERENCE === "1" ? reference : student;
const signal = new AbortController().signal;

async function fixture(t: TestContext): Promise<{ root: string; outer: string; tools: Tool[] }> {
  const outer = await mkdtemp(join(tmpdir(), "pi-course-tools-"));
  t.after(() => rm(outer, { recursive: true, force: true }));
  const root = join(outer, "project");
  await mkdir(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/greeting.mjs"), 'export const greeting = "hello";\n');
  await writeFile(join(outer, "outside.txt"), "outside unchanged");
  return { root, outer, tools: await api.createWorkspaceTools(root) };
}

test("read → exact edit → syntax check changes a real fixture file", async (t) => {
  const { root, tools } = await fixture(t);
  const read = await executeToolCall({ id: "r", name: "read_file", arguments: { path: "src/greeting.mjs" } }, tools, signal);
  assert.equal(read.content, 'export const greeting = "hello";\n');
  await chmod(join(root, "src/greeting.mjs"), 0o755);
  const edit = await executeToolCall({ id: "e", name: "edit_file", arguments: { path: "src/greeting.mjs", oldText: '"hello"', newText: '"你好"' } }, tools, signal);
  assert.equal(edit.isError, false);
  assert.equal(await readFile(join(root, "src/greeting.mjs"), "utf8"), 'export const greeting = "你好";\n');
  assert.equal((await stat(join(root, "src/greeting.mjs"))).mode & 0o777, 0o755);
  const checked = await executeToolCall({ id: "c", name: "check_file", arguments: { path: "src/greeting.mjs" } }, tools, signal);
  assert.equal(checked.isError, false);
  assert.match(checked.content, /exitCode=0/);
});

test("write creates a file only in an existing authorized parent", async (t) => {
  const { root, tools } = await fixture(t);
  const result = await executeToolCall({ id: "w", name: "write_file", arguments: { path: "src/new.mjs", content: "export const answer = 42;" } }, tools, signal);
  assert.equal(result.isError, false);
  assert.equal(await readFile(join(root, "src/new.mjs"), "utf8"), "export const answer = 42;");
  const missing = await executeToolCall({ id: "w2", name: "write_file", arguments: { path: "missing/new.mjs", content: "x" } }, tools, signal);
  assert.equal(missing.isError, true);
  assert.deepEqual((await readdir(join(root, "src"))).filter((name) => name.endsWith(".tmp")), []);
});

test("ambiguous, missing and overlapping replacements preserve original text", async (t) => {
  const { root, tools } = await fixture(t);
  await writeFile(join(root, "a.txt"), "aaaa");
  for (const oldText of ["", "z", "aa"]) {
    const result = await executeToolCall({ id: oldText || "empty", name: "edit_file", arguments: { path: "a.txt", oldText, newText: "b" } }, tools, signal);
    assert.equal(result.isError, true);
    assert.equal(await readFile(join(root, "a.txt"), "utf8"), "aaaa");
  }
  assert.equal(api.replaceExactlyOnce("ab\r\ncd\r\n", "cd", "EF"), "ab\r\nEF\r\n");
});

test("parent traversal, absolute, hidden and non-file paths are rejected", async (t) => {
  const { root, outer } = await fixture(t);
  for (const path of ["../outside.txt", join(outer, "outside.txt"), "src/../a", "src//a", ".env", "src/.hidden", "src", "src\\a", "src/\0a"]) {
    await assert.rejects(api.resolveWorkspacePath(root, path, "existing"));
  }
  assert.equal(await readFile(join(outer, "outside.txt"), "utf8"), "outside unchanged");
});

test("stable symlinks including dangling and directory links cannot be read or written", async (t) => {
  const { root, outer, tools } = await fixture(t);
  await symlink(join(outer, "outside.txt"), join(root, "alias.txt"));
  await symlink(outer, join(root, "escape"));
  await symlink(join(outer, "absent.txt"), join(root, "dangling"));
  for (const path of ["alias.txt", "escape/outside.txt", "escape/new.txt", "dangling"]) {
    const result = await executeToolCall({ id: path, name: "write_file", arguments: { path, content: "must not write" } }, tools, signal);
    assert.equal(result.isError, true);
    assert.match(result.content, /Symbolic links/);
  }
  assert.equal(await readFile(join(outer, "outside.txt"), "utf8"), "outside unchanged");
  await assert.rejects(readFile(join(outer, "new.txt")));
});

test("hard-link aliases are refused", async (t) => {
  const { root, outer } = await fixture(t);
  await link(join(outer, "outside.txt"), join(root, "hard.txt"));
  await assert.rejects(api.resolveWorkspacePath(root, "hard.txt", "existing"), /hard link/);
});

test("read output reports truncation and rejects oversized inputs", async (t) => {
  const { root, tools } = await fixture(t);
  await writeFile(join(root, "long.txt"), "a".repeat(5000));
  const result = await executeToolCall({ id: "r", name: "read_file", arguments: { path: "long.txt" } }, tools, signal);
  assert.equal(result.isError, false);
  assert.match(result.content, /output truncated: 4096\/5000 bytes/);
  await writeFile(join(root, "huge.txt"), "a".repeat(65537));
  const huge = await executeToolCall({ id: "r2", name: "read_file", arguments: { path: "huge.txt" } }, tools, signal);
  assert.equal(huge.isError, true);
  assert.match(huge.content, /64 KiB/);
});

test("syntax failure is not success and check never executes the target", async (t) => {
  const { root, tools } = await fixture(t);
  await writeFile(join(root, "bad.mjs"), "const value = ;");
  const bad = await executeToolCall({ id: "c", name: "check_file", arguments: { path: "bad.mjs" } }, tools, signal);
  assert.equal(bad.isError, true);
  assert.match(bad.content, /exitCode=1/);
  await writeFile(join(root, "never-run.mjs"), 'throw new Error("this file was executed");');
  const parsed = await executeToolCall({ id: "p", name: "check_file", arguments: { path: "never-run.mjs" } }, tools, signal);
  assert.equal(parsed.isError, false);
  assert.match(parsed.content, /exitCode=0/);
});

test("child output, timeout and cancellation have explicit outcomes", async () => {
  await assert.rejects(runSyntaxCheck("const = ;", signal, { mode: "module", timeoutMs: 2000, maxOutputBytes: 12 }), /output truncated/);
  await assert.rejects(runSyntaxCheck("let x;", signal, { mode: "module", timeoutMs: 1, maxOutputBytes: 4096 }), /timeout/);
  const controller = new AbortController();
  const pending = runSyntaxCheck("let x;", controller.signal, { mode: "module", timeoutMs: 2000, maxOutputBytes: 4096 });
  controller.abort(new Error("user cancelled check"));
  await assert.rejects(pending, /user cancelled check/);
});

test("pre-cancelled mutations leave files unchanged", async (t) => {
  const { root, tools } = await fixture(t);
  const controller = new AbortController();
  controller.abort(new Error("stop"));
  await assert.rejects(executeToolCall({ id: "w", name: "write_file", arguments: { path: "src/greeting.mjs", content: "bad" } }, tools, controller.signal), /stop/);
  assert.equal(await readFile(join(root, "src/greeting.mjs"), "utf8"), 'export const greeting = "hello";\n');
});
