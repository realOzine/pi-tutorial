// 在独立临时目录中验证轨迹导出，不执行 shell 或调用模型 API。

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../labs/01-agent-loop/cli.ts", import.meta.url));

async function fixture(context) {
  const directory = await mkdtemp(join(tmpdir(), "pi-tutorial-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function run(directory, ...args) {
  const result = spawnSync(process.execPath, [cli, "--reference", ...args], {
    cwd: directory,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  return result;
}

test("合法轨迹导出自动创建嵌套目录", async (context) => {
  const directory = await fixture(context);
  const result = run(directory, "--trace", "artifacts/lesson-01/run/trace.json");
  assert.equal(result.status, 0, result.stderr);
  const trace = JSON.parse(await readFile(join(directory, "artifacts/lesson-01/run/trace.json"), "utf8"));
  assert.equal(trace.version, 1);
  assert.equal(trace.origin, "scripted-model");
  assert.equal(trace.events[0].kind, "request");
  assert.equal(trace.events.at(-1).kind, "stop");
});

test("无效场景退出，不创建输出", async (context) => {
  const directory = await fixture(context);
  const result = run(directory, "--scenario", "unknown", "--trace", "artifacts/trace.json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--scenario 只接受/);
  assert.deepEqual(await readdir(directory), []);
});

test("拒绝通过 .. 逃出 artifacts", async (context) => {
  const directory = await fixture(context);
  const result = run(directory, "--trace", "artifacts/../escape.json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--trace 必须是 artifacts/);
  assert.deepEqual(await readdir(directory), []);
});

test("拒绝把 artifacts 本身链接到其他目录", async (context) => {
  const directory = await fixture(context);
  const outside = join(directory, "outside");
  await mkdir(outside);
  await symlink(outside, join(directory, "artifacts"), "dir");
  const result = run(directory, "--trace", "artifacts/new/escape.json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /不能使用符号链接/);
  assert.deepEqual(await readdir(outside), []);
});

test("拒绝子目录符号链接，不在链接目标内创建新目录", async (context) => {
  const directory = await fixture(context);
  const outside = join(directory, "outside");
  await mkdir(outside);
  await mkdir(join(directory, "artifacts"));
  await symlink(outside, join(directory, "artifacts/link"), "dir");
  const result = run(directory, "--trace", "artifacts/link/new/sub/escape.json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /不能使用符号链接/);
  assert.deepEqual(await readdir(outside), []);
});

test("重复导出失败，保留已有文件内容", async (context) => {
  const directory = await fixture(context);
  const tracePath = join(directory, "artifacts/trace.json");
  assert.equal(run(directory, "--trace", "artifacts/trace.json").status, 0);
  const original = await readFile(tracePath, "utf8");
  const result = run(directory, "--scenario", "budget", "--trace", "artifacts/trace.json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EEXIST/);
  assert.equal(await readFile(tracePath, "utf8"), original);
});

test("目标文件是符号链接时不修改链接指向的文件", async (context) => {
  const directory = await fixture(context);
  const outside = join(directory, "outside.json");
  await writeFile(outside, "保留内容");
  await mkdir(join(directory, "artifacts"));
  await symlink(outside, join(directory, "artifacts/trace.json"), "file");
  const result = run(directory, "--trace", "artifacts/trace.json");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EEXIST/);
  assert.equal(await readFile(outside, "utf8"), "保留内容");
});
