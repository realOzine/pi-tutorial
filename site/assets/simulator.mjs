// Lesson-one traces: deterministic teaching data and validation at the file boundary.
export const MAX_TRACE_BYTES = 1024 * 1024;

export const SCENARIOS = {
  readme: "读取 README 并回答",
  "tool-error": "文件不存在，修正路径后重试",
  budget: "达到模型调用预算",
};

/** Build a scripted trace without reading files, running tools, or calling a model. */
export function createDemoTrace(scenario) {
  if (!Object.hasOwn(SCENARIOS, scenario)) throw new Error("未知的教学场景。");
  const messages = [{
    role: "user",
    content: scenario === "tool-error"
      ? "读取 docs/README.md；如果不存在，再尝试 README.md，告诉我项目名称和启动命令。"
      : "读取 README.md，告诉我项目名称和启动命令。",
  }];
  const events = [];
  const record = (kind, label) => events.push({ kind, label, messages: [...messages] });
  const rounds = scenario === "readme" ? 1 : 2;

  for (let round = 1; round <= rounds; round += 1) {
    record("request", `第 ${round} 次模型请求：发送当前消息历史`);
    const failed = scenario === "tool-error" && round === 1;
    const path = failed ? "docs/README.md" : "README.md";
    messages.push({
      role: "assistant",
      content: scenario === "tool-error" && round === 2 ? "读取失败，尝试根目录 README.md。" : "先读取文件，再根据结果回答。",
      toolCalls: [{ id: `call-${round}`, name: "read_file", path }],
    });
    record("assistant", `模型返回工具请求：read_file(${path})`);
    messages.push({
      role: "tool",
      callId: `call-${round}`,
      content: failed ? "找不到内存文件：docs/README.md" : "# Tiny Notes\n启动命令：npm run dev\n这是实验中的内存文件，不是课程仓库的 README。",
      isError: failed,
    });
    record("tool", failed ? "运行时把工具错误写回历史" : "运行时把文件内容写回历史");
  }

  if (scenario === "budget") {
    record("stop", "模型调用预算已用完：停止，没有得到最终回答");
  } else {
    record("request", `第 ${rounds + 1} 次模型请求：连同工具结果一起发送`);
    messages.push({
      role: "assistant",
      content: "README.md 中的项目名称是 Tiny Notes，启动命令是 npm run dev。",
      toolCalls: [],
    });
    record("assistant", "模型返回回答，本轮没有工具请求");
    record("stop", "循环结束：收到没有工具请求的回答");
  }
  return { version: 1, origin: "scripted-model", scenario, events };
}

/** Select a step and count only the events visible up to that step. */
export function getStep(trace, index) {
  const position = Math.max(0, Math.min(trace.events.length - 1, Math.trunc(index) || 0));
  const event = trace.events[position];
  const states = { request: "等待模型", assistant: "检查模型输出", tool: "工具结果已记录", stop: "已停止" };
  return {
    position,
    event,
    state: states[event.kind],
    requests: trace.events.slice(0, position + 1).filter((item) => item.kind === "request").length,
    toolResults: event.messages.filter((message) => message.role === "tool").length,
    atStart: position === 0,
    atEnd: position === trace.events.length - 1,
  };
}

/** Parse a bounded local JSON file; imported text is data, never executable code. */
export function parseTrace(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_TRACE_BYTES) {
    throw new Error("轨迹文件不能超过 1 MiB。");
  }
  let trace;
  try {
    trace = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON。请导入实验命令生成的轨迹。");
  }
  if (!isRecord(trace) || trace.version !== 1 || trace.origin !== "scripted-model" || typeof trace.scenario !== "string"
    || !Object.hasOwn(SCENARIOS, trace.scenario)) {
    throw new Error("轨迹须使用 version: 1、origin: scripted-model 和受支持的 scenario。");
  }
  if (!Array.isArray(trace.events) || trace.events.length < 2 || trace.events.length > 500) {
    throw new Error("轨迹必须包含 2 至 500 个事件。");
  }
  for (const [index, event] of trace.events.entries()) {
    if (!isRecord(event) || !["request", "assistant", "tool", "stop"].includes(event.kind)
      || !isText(event.label, 300) || !Array.isArray(event.messages)
      || event.messages.length === 0 || event.messages.length > 200) {
      throw new Error(`第 ${index + 1} 个事件的格式不正确。`);
    }
    validateMessages(event.messages, index + 1);
  }
  if (trace.events[0].kind !== "request" || trace.events.at(-1).kind !== "stop"
    || trace.events.slice(0, -1).some((event) => event.kind === "stop")) {
    throw new Error("完整轨迹必须从 request 开始，并以唯一的 stop 事件结束。");
  }
  return trace;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isText(value, limit) {
  return typeof value === "string" && value.length <= limit;
}

function validateMessages(messages, eventNumber) {
  const pending = new Set();
  const seen = new Set();
  for (const message of messages) {
    let valid = isRecord(message) && isText(message.content, 50_000);
    if (valid && message.role === "assistant") {
      valid = Array.isArray(message.toolCalls) && message.toolCalls.length <= 16;
      if (valid) {
        for (const call of message.toolCalls) {
          if (!isRecord(call) || !isText(call.id, 200) || call.id.length === 0
            || !isText(call.name, 200) || call.name.length === 0 || !isText(call.path, 2_000)
            || seen.has(call.id)) {
            valid = false;
            break;
          }
          seen.add(call.id);
          pending.add(call.id);
        }
      }
    } else if (valid && message.role === "tool") {
      valid = typeof message.isError === "boolean" && isText(message.callId, 200) && pending.has(message.callId);
      pending.delete(message.callId);
    } else if (valid) {
      valid = message.role === "user";
    }
    if (!valid) throw new Error(`第 ${eventNumber} 个事件含有格式错误或调用关联错误的消息。`);
  }
}
