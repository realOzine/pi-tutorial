// Render the lesson's local, scripted traces; imported content always remains text.
import { createDemoTrace, getStep, MAX_TRACE_BYTES, parseTrace } from "./simulator.mjs";

const scenario = document.querySelector("#scenario");
const previous = document.querySelector("#previous");
const next = document.querySelector("#next");
const source = document.querySelector("#trace-source");
const feedback = document.querySelector("#import-feedback");
let trace = createDemoTrace("readme");
let position = 0;

function render() {
  const step = getStep(trace, position);
  position = step.position;
  document.querySelector("#step-count").textContent = `观察点 ${position + 1} / ${trace.events.length}`;
  document.querySelector("#current-step").textContent = step.event.label;
  document.querySelector("#state").textContent = step.state;
  document.querySelector("#requests").textContent = String(step.requests);
  document.querySelector("#tool-results").textContent = String(step.toolResults);
  previous.disabled = step.atStart;
  next.disabled = step.atEnd;
  for (const node of document.querySelectorAll("[data-kind]")) {
    if (node.dataset.kind === step.event.kind) node.setAttribute("aria-current", "step");
    else node.removeAttribute("aria-current");
  }
  document.querySelector("#messages").replaceChildren(...step.event.messages.map(renderMessage));
  document.querySelector("#events").replaceChildren(...trace.events.slice(0, position + 1).map((event, index) => {
    const item = element("li", "", event.label);
    if (index === position) item.setAttribute("aria-current", "step");
    return item;
  }));
}

function renderMessage(message) {
  const card = element("div", message.role === "tool" && message.isError ? "message error" : "message");
  const title = message.role === "tool" ? `tool · ${message.callId}${message.isError ? " · 错误" : ""}` : message.role;
  card.append(element("div", "message-role", title), element("p", "", message.content));
  if (message.role === "assistant" && message.toolCalls.length > 0) {
    card.append(element("pre", "", JSON.stringify({ toolCalls: message.toolCalls }, null, 2)));
  }
  return card;
}

function element(tag, className, text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

previous.addEventListener("click", () => { position -= 1; render(); });
next.addEventListener("click", () => { position += 1; render(); });
document.querySelector("#reset").addEventListener("click", () => { position = 0; render(); });
scenario.addEventListener("change", () => {
  trace = createDemoTrace(scenario.value);
  position = 0;
  source.textContent = "内置教学模拟 · 不调用模型，也不读取你的文件";
  feedback.textContent = "";
  document.querySelector("#trace-file").value = "";
  render();
});

document.querySelector("#trace-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > MAX_TRACE_BYTES) throw new Error("轨迹文件不能超过 1 MiB。");
    const imported = parseTrace(await file.text());
    trace = imported;
    position = 0;
    scenario.value = imported.scenario;
    source.textContent = `本地模拟模型记录 · ${file.name} · 文件标注 scripted-model，非真实 LLM`;
    feedback.className = "feedback";
    feedback.textContent = `已导入 ${imported.events.length} 个事件。文件只在当前页面内读取。`;
    render();
  } catch (error) {
    feedback.className = "feedback error";
    feedback.textContent = `${error.message} 当前轨迹保持不变。`;
  }
});

const answers = {
  q1: { value: "tool", explanation: "是否继续取决于 toolCalls，而不是有没有文字。先记录请求，才能把随后的工具结果关联回来。" },
  q2: { value: "history", explanation: "错误也是观察结果。记录错误给模型调整下一步的机会，但不能保证它恢复成功。" },
  q3: { value: "budget", explanation: "maxSteps 限制模型调用次数。本轮已产生的工具仍要执行并记录；没有最终回答，因此状态是 budget。" },
};

document.querySelector("#quiz").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  let correct = 0;
  for (const [name, answer] of Object.entries(answers)) {
    const choice = form.get(name);
    const passed = choice === answer.value;
    if (passed) correct += 1;
    const result = document.querySelector(`#${name}-feedback`);
    result.className = passed ? "feedback quiz-result" : "feedback error quiz-result";
    result.textContent = choice === null ? "先选一个答案，再检查这一题。" : `${passed ? "正确。" : "再想一下。"}${answer.explanation}`;
  }
  document.querySelector("#quiz-summary").textContent = `${correct} / 3 题正确。${correct === 3 ? "接下来用你自己的代码验证这些约定。" : "请结合每题反馈回看消息历史。"}`;
});

render();
