// Run a real journal close/reopen sequence using a temporary directory, without a model call.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSession } from "../../solutions/08-sessions.ts";

const dir = mkdtempSync(join(tmpdir(), "pi-session-demo-"));
try {
  const path = join(dir, "session.jsonl");
  const journal = openSession(path);
  journal.appendMessage({ role: "user", content: "把版本改成 2" });
  journal.appendMessage({ role: "assistant", content: "", toolCalls: [{ id: "write-1", name: "edit", arguments: { version: 2 } }] });
  console.log("工具调用已记录，但结果未记录；重开文件：");
  console.log(JSON.stringify(openSession(path).project(), null, 2));
  console.log("这里没有执行或重试 edit。先检查外部文件，再由人工决定如何处置。");
  journal.appendMessage({ role: "tool", callId: "write-1", content: "已人工核对：文件版本为 2", isError: false });
  console.log("补记核对结果后：", openSession(path).project().status);
} finally { rmSync(dir, { recursive: true }); }
