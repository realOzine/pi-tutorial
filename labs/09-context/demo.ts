// Compare fixed context policies with the same evidence question; this is not a model benchmark.
import type { Message } from "../shared/contracts.ts";
import { selectContext } from "../../solutions/09-context.ts";

const history: Message[] = [
  { role: "user", content: "项目必须兼容端口 8080。" },
  { role: "assistant", content: "调试日志：" + "无关内容".repeat(250), toolCalls: [] },
  { role: "user", content: "最终应保留哪个端口？" },
];
for (const mode of ["full", "trim", "summary"] as const) {
  const result = await selectContext(history, { mode, maxCharacters: 280 }, async old => {
    return old[0].content;
  });
  console.log(JSON.stringify({ mode, ...result, containsConstraint: result.messages.some(message => message.content.includes("8080")) }, null, 2));
}
console.log("摘要器只复制固定的首条约束；保留字符串不等于真实模型回答正确。原历史消息数：", history.length);
