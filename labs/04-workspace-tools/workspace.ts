// File and child-process scaffolding; learner functions decide path access and exact matching.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, rename, unlink } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import type { Tool } from "../shared/contracts.ts";

export type PathMode = "existing" | "new-or-existing";
export type ResolvePath = (root: string, path: string, mode: PathMode) => Promise<string>;
export type ReplaceText = (content: string, oldText: string, newText: string) => string;
export const MAX_FILE_BYTES = 64 * 1024;
export const MAX_OUTPUT_BYTES = 4096;

/** Assemble read/write/edit/check using the supplied learner or reference policies. */
export async function createToolSet(root: string, resolvePath: ResolvePath, replace: ReplaceText): Promise<Tool[]> {
  const workspace = await realpath(root);
  const specifications = [
    { name: "read_file", description: "Read a UTF-8 file within the workspace; output may be truncated", fields: ["path"] },
    { name: "write_file", description: "Create or overwrite a UTF-8 file; the parent directory must already exist", fields: ["path", "content"] },
    { name: "edit_file", description: "Replace one unique exact text occurrence; read the file first", fields: ["path", "oldText", "newText"] },
    { name: "check_file", description: "Check JavaScript syntax with node --check; does not execute the program", fields: ["path"] },
  ];
  return specifications.map(({ name, description, fields }): Tool => ({
    definition: { name, description, parameters: { type: "object", properties: Object.fromEntries(fields.map((field) => [field, { type: "string" }])),
      required: fields, additionalProperties: false } },
    execution: name === "read_file" ? "parallel" : "sequential",
    validate: (args) => { stringFields(args, fields); },
    run: async (args, signal) => {
      signal.throwIfAborted();
      const values = stringFields(args, fields);
      const path = await resolvePath(workspace, values.path, name === "write_file" ? "new-or-existing" : "existing");
      signal.throwIfAborted();
      if (name === "write_file") {
        await replaceFile(path, values.content, signal);
        return `Wrote ${Buffer.byteLength(values.content)} bytes to ${values.path}`;
      }
      const content = await readBounded(path, signal);
      if (name === "read_file") return boundedOutput(Buffer.from(content), MAX_OUTPUT_BYTES);
      if (name === "edit_file") {
        const changed = replace(content, values.oldText, values.newText);
        await replaceFile(path, changed, signal);
        return `Replaced one occurrence in ${values.path}`;
      }
      if (![".js", ".mjs", ".cjs"].includes(extname(path))) throw new Error("check_file accepts .js, .mjs or .cjs only");
      return runSyntaxCheck(content, signal, { mode: extname(path) === ".cjs" ? "commonjs" : "module", timeoutMs: 2000, maxOutputBytes: MAX_OUTPUT_BYTES });
    },
  }));
}

function stringFields(value: unknown, fields: readonly string[]): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected an object");
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== fields.length || fields.some((key) => typeof object[key] !== "string")) throw new Error(`Expected exactly string fields: ${fields.join(", ")}`);
  // The boundary check above establishes the string values for all permitted keys.
  return object as Record<string, string>;
}

async function readBounded(path: string, signal: AbortSignal): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1) throw new Error("Expected a regular file with one hard link");
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      signal.throwIfAborted();
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    signal.throwIfAborted();
    if (size > MAX_FILE_BYTES) throw new Error("File exceeds 64 KiB lesson limit");
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, size));
  } finally { await file.close(); }
}

async function replaceFile(path: string, content: string, signal: AbortSignal): Promise<void> {
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error("Content exceeds 64 KiB lesson limit");
  signal.throwIfAborted();
  let mode = 0o600;
  try {
    const existing = await lstat(path);
    if (!existing.isFile() || existing.nlink !== 1) throw new Error("Expected a regular file with one hard link");
    mode = existing.mode & 0o777;
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const temporary = join(dirname(path), `.pi-course-${randomUUID()}.tmp`);
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(content, "utf8");
    await file.chmod(mode);
    await file.close();
    signal.throwIfAborted();
    // shortcut: a trusted stable parent directory is required; Node lacks a portable openat-style path capability.
    await rename(temporary, path);
    signal.throwIfAborted();
  } finally {
    await file.close();
    await unlink(temporary).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    });
  }
}

/** Parse source in a child process, with explicit deadline, bounded output and cancellation. */
export async function runSyntaxCheck(source: string, signal: AbortSignal,
  options: { mode: "module" | "commonjs"; timeoutMs: number; maxOutputBytes: number }): Promise<string> {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || !Number.isSafeInteger(options.maxOutputBytes) || options.maxOutputBytes < 1) throw new Error("Invalid check limits");
  const child = spawn(process.execPath, ["--check", `--input-type=${options.mode}`], { stdio: ["pipe", "pipe", "pipe"], env: {} });
  let output = Buffer.alloc(0);
  let total = 0;
  let timedOut = false;
  const collect = (chunk: Buffer) => {
    total += chunk.length;
    if (output.length < options.maxOutputBytes) output = Buffer.concat([output, chunk.subarray(0, options.maxOutputBytes - output.length)]);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  const cancel = () => { child.kill("SIGKILL"); };
  const timer = setTimeout(() => { timedOut = true; cancel(); }, options.timeoutMs);
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  child.stdin.on("error", () => {});
  child.stdin.end(source);
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    signal.throwIfAborted();
    if (timedOut) throw new Error(`check_file timeout after ${options.timeoutMs} ms`);
    const text = output.toString("utf8") + (total > output.length ? `\n[output truncated: ${output.length}/${total} bytes]` : "");
    if (code !== 0) throw new Error(`check_file failed: exitCode=${String(code)}\n${text}`);
    return `exitCode=0\n${text || "JavaScript syntax check passed"}`;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

function boundedOutput(buffer: Buffer, maximum: number): string {
  return buffer.length <= maximum ? buffer.toString("utf8") : `${buffer.subarray(0, maximum).toString("utf8")}\n[output truncated: ${maximum}/${buffer.length} bytes]`;
}
