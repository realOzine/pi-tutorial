// An append-only teaching journal; one process owns each file, with explicit recovery copies.
import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeFileSync } from "node:fs";
import type { Message, ToolCall } from "../labs/shared/contracts.ts";
import type { SessionEntry, SessionProjection } from "../labs/08-sessions/exercise.ts";

/** Follow one branch and refuse to invent results for unfinished tool calls. */
export function projectSession(entries: readonly SessionEntry[], leafId: string | null): SessionProjection {
  const index = new Map(entries.map(entry => [entry.id, entry]));
  const path: SessionEntry[] = [];
  const visited = new Set<string>();
  let cursor = leafId;
  while (cursor !== null) {
    if (visited.has(cursor)) throw new Error("Session parent cycle");
    visited.add(cursor);
    const entry = index.get(cursor);
    if (!entry) throw new Error(`Missing session entry: ${cursor}`);
    path.push(entry);
    cursor = entry.parentId;
  }
  path.reverse();
  const messages: Message[] = [];
  const pending = new Map<string, ToolCall>();
  const seen = new Set<string>();
  let exchangeStart = 0;
  for (const { message } of path) {
    if (message.role === "tool") {
      if (!pending.delete(message.callId)) throw new Error(`Orphan or duplicate tool result: ${message.callId}`);
    } else {
      if (pending.size) throw new Error("Unfinished tool exchange before a later message");
      if (message.role === "assistant") {
        exchangeStart = messages.length;
        for (const call of message.toolCalls) {
          if (seen.has(call.id)) throw new Error(`Duplicate tool call: ${call.id}`);
          seen.add(call.id);
          pending.set(call.id, call);
        }
      }
    }
    messages.push(message);
  }
  return {
    status: pending.size ? "needs_review" : "ready",
    messages: pending.size ? messages.slice(0, exchangeStart) : messages,
    pending: [...pending.values()],
    leafId,
  };
}

/** Open a complete journal; a partial final line requires an explicit recovery copy. */
export function openSession(path: string): SessionStore {
  if (!existsSync(path)) writeFileSync(path, "", { flag: "wx", mode: 0o600 });
  const parsed = readJournal(path);
  if (parsed.tail) throw new Error("Incomplete final line: use recoverSession(source, newPath); original is unchanged");
  return new SessionStore(path, parsed.entries);
}

/** Copy complete, valid records to a new file without modifying the damaged original. */
export function recoverSession(source: string, destination: string): number {
  const { entries } = readJournal(source);
  const content = entries.map(entry => JSON.stringify(entry)).join("\n");
  writeFileSync(destination, content ? `${content}\n` : "", { flag: "wx", mode: 0o600 });
  return entries.length;
}

/** Append messages and select branches; this store never executes tools. */
export class SessionStore {
  private path: string;
  private entries: SessionEntry[];
  private leafId: string | null;
  private failed = false;

  constructor(path: string, entries: SessionEntry[]) {
    this.path = path;
    this.entries = entries;
    this.leafId = entries.at(-1)?.id ?? null;
  }

  /** Persist a child before updating memory; after an I/O error reopen to inspect disk. */
  appendMessage(message: Message): string {
    if (this.failed) throw new Error("Journal write was uncertain; reopen before continuing");
    const entry: SessionEntry = { version: 1, id: randomUUID(), parentId: this.leafId, message };
    projectSession([...this.entries, entry], entry.id);
    try {
      const fd = openSync(this.path, "a");
      try {
        writeFileSync(fd, `${JSON.stringify(entry)}\n`);
        fsyncSync(fd);
      } finally { closeSync(fd); }
    } catch (error) {
      this.failed = true;
      throw error;
    }
    this.entries.push(entry);
    this.leafId = entry.id;
    return entry.id;
  }

  /** Move the in-memory leaf; the next append records the selected parent durably. */
  branch(id: string): void {
    if (!this.entries.some(entry => entry.id === id)) throw new Error(`Missing branch entry: ${id}`);
    this.leafId = id;
  }

  /** Return only model-safe messages, with uncertain calls separately identified. */
  project(): SessionProjection { return projectSession(this.entries, this.leafId); }

  /** Expose original records for inspection; callers treat these as immutable. */
  getEntries(): readonly SessionEntry[] { return this.entries; }
}

function readJournal(path: string): { entries: SessionEntry[]; tail: string } {
  const content = readFileSync(path, "utf8");
  const lines = content.split("\n");
  const tail = lines.pop() ?? "";
  const entries: SessionEntry[] = [];
  const ids = new Set<string>();
  for (const [line, text] of lines.entries()) {
    // The file is a trust boundary: reject corrupt completed records, not just invalid JSON.
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || value.version !== 1 || typeof value.id !== "string" || !value.id ||
        !(value.parentId === null || typeof value.parentId === "string") || !isMessage(value.message)) {
      throw new Error(`Invalid session record at line ${line + 1}`);
    }
    if (ids.has(value.id) || (value.parentId !== null && !ids.has(value.parentId))) {
      throw new Error(`Duplicate id or missing parent at line ${line + 1}`);
    }
    ids.add(value.id);
    entries.push({ version: 1, id: value.id, parentId: value.parentId, message: value.message });
  }
  return { entries, tail };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value) || typeof value.content !== "string") return false;
  if (value.role === "user") return true;
  if (value.role === "tool") return typeof value.callId === "string" && typeof value.isError === "boolean";
  if (value.role !== "assistant" || !Array.isArray(value.toolCalls)) return false;
  return value.toolCalls.every(call => isRecord(call) && typeof call.id === "string" && call.id.length > 0 &&
    typeof call.name === "string" && call.name.length > 0 && "arguments" in call);
}
