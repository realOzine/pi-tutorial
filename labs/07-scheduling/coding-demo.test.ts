// Exercise the real stage-07 CLI through stdin and inspect its generated files and trace.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = fileURLToPath(new URL("./coding-demo.ts", import.meta.url));

async function runCli(action: "steer" | "stop"): Promise<{ events: Record<string, unknown>[]; workspace: string }> {
  const child = spawn(process.execPath, [cli, "--interactive", "--delay-ms", "25"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  const events: Record<string, unknown>[] = [];
  let buffer = ""; let errors = ""; let sent = false; let workspace = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => { errors += chunk; });
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const event = JSON.parse(buffer.slice(0, boundary)) as Record<string, unknown>;
      buffer = buffer.slice(boundary + 1);
      events.push(event);
      if (event.type === "workspace") workspace = String(event.path);
      if (event.type === "ready") child.stdin.write("/start\n");
      if (event.type === "stream" && !sent) {
        sent = true;
        child.stdin.end(action === "stop" ? "/stop\n" : "/steer 用中文解释修改\n/follow 最后再总结一次\n");
      }
      boundary = buffer.indexOf("\n");
    }
  });
  const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    assert.equal(code, 0, errors || "CLI did not complete");
    assert(workspace);
    const path = relative(join(root, "artifacts"), workspace);
    assert.match(path, /^lesson-07-[^/]+$/);
    return { events, workspace };
  } catch (error) {
    if (workspace && /^lesson-07-[^/]+$/.test(relative(join(root, "artifacts"), workspace))) await rm(workspace, { recursive: true });
    throw error;
  } finally { clearTimeout(timer); }
}

test("coding CLI reads, edits, checks real files and honors stdin steering/follow-up", async () => {
  const { events, workspace } = await runCli("steer");
  try {
    const result = events.find((event) => event.type === "result");
    assert.equal(result?.status, "completed"); assert.equal(result.steps, 4);
    assert.equal(await readFile(join(workspace, "greeting.mjs"), "utf8"), 'export const greeting = "hello";\nconsole.log(greeting);\n');
    const trace = JSON.parse(await readFile(join(workspace, "trace.json"), "utf8")) as { messages: { role: string; content: string; callId?: string; isError?: boolean }[] };
    const users = trace.messages.filter((message) => message.role === "user").map((message) => message.content);
    assert.deepEqual(users.slice(-2), ["用中文解释修改", "最后再总结一次"]);
    const outputs = trace.messages.filter((message) => message.role === "tool");
    assert.deepEqual(outputs.map((message) => message.callId), ["read-main", "read-readme", "edit-main", "check-main"]);
    assert(outputs.every((message) => !message.isError));
    assert.match(outputs.at(-1)?.content ?? "", /exitCode=0/);
    assert(trace.messages.at(-1)?.content.includes("最后再总结一次"));
  } finally { await rm(workspace, { recursive: true }); }
});

test("stdin stop cancels the incremental model before tool effects", async () => {
  const { events, workspace } = await runCli("stop");
  try {
    assert.equal(events.find((event) => event.type === "result")?.status, "cancelled");
    assert.equal(events.filter((event) => event.type === "tool-completed").length, 0);
    assert.equal(await readFile(join(workspace, "greeting.mjs"), "utf8"), 'export const greeting = "hello";\nconsole.log(greeting;\n');
  } finally { await rm(workspace, { recursive: true }); }
});

test("CLI help describes scope and exits without a model call", () => {
  const result = spawnSync(process.execPath, [cli, "--help"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0); assert.match(result.stdout, /无付费调用/); assert.match(result.stdout, /\/steer/);
  assert.doesNotMatch(result.stdout, /"type":"workspace"/);
});
