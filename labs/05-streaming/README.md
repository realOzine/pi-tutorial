# 05 · 流式输出与事件

这一课把“等待完整回答”拆成可观察的增量过程。你实现 `exercise.ts` 中的 `consumeStream`，参考实现单独位于 `solutions/05-streaming.ts`。

在课程仓库根目录运行：

```sh
npm run lab -- 05 test
npm run lab -- 05 verify
npm run lab -- 05 demo
```

如通用入口尚未合并，可直接运行：

```sh
node --test labs/05-streaming/exercise.test.ts
PI_TUTORIAL_REFERENCE=1 node --test labs/05-streaming/exercise.test.ts
node labs/05-streaming/demo.ts
```

第一条检查学生实现，初始 TODO 应失败；`verify` 只检查参考实现。默认不请求外部 API。测试中的 HTTP 服务器绑定随机 loopback 端口，按 SSE 帧逐步发出教学协议数据，证明消费者能在响应结束之前收到增量；这不证明任何供应商的真实流式接口已经通过验证。

## 实现契约

输入为 `AsyncIterable<StreamPart>`、取消信号和可选事件监听器。`text` 拼接文字；`tool-start` 建立按调用 ID 索引的临时记录；`tool-delta` 拼接原始参数字符串。每次增量产生 `preview`，其中参数仍为字符串，不能交给执行器。

遇到 `finish` 才解析完整参数，并返回共享 `ModelResponse`；只发出一次 `commit`。存在工具时结束原因必须为 `tool_calls`，没有工具时不能为 `tool_calls`。工具响应被 `length` 截断时整条拒绝，即使 JSON 恰好能解析；纯文字截断可返回 `length`，由上层决定是否继续。

提前 EOF、重复调用 ID、没有 start 的 delta、坏 JSON、监听器异常或取消都应抛出。工具 schema 校验仍属于第 02 课，JSON.parse 成功不等于获得执行权。每个事件监听器都被 `await`；它因此影响后续读取和运行结束时点。

`transport.ts` 是脚手架：正确处理跨网络 chunk 的 UTF-8 和 SSE 帧，对网络 JSON 做运行时校验，并限制缓冲区。它是课程定义的 SSE 数据形状，不是 OpenAI、DeepSeek 或 pi 的事件 API。真实 provider 需要自己的映射层。

## 真实 OpenAI Responses 流适配

`openai.ts` 提供 `createStreamingOpenAIModel(config, onEvent?)`，config 与第 03 课的 `OpenAIModelConfig` 相同，返回共享 `Model`。它复用第 03 课的请求编码和最终响应校验，发送 `stream: true`，保持 `store: false`、reasoning effort `none`、显式输出上限、超时与禁止自动重试。

网络中每个 Responses 事件先经过 SSE 解码，再映射为本课增量；函数参数事件的 `item_id` 必须映射为调用结果使用的 `call_id`。`function_call_arguments.done` 只代表参数结束，只有 `response.completed` 才提交整个响应。完整响应还会与增量累积核对，避免界面与执行器看到不同内容。仅支持文本和函数工具；reasoning、图片和托管工具不在这个适配器的范围内。

`openai.test.ts` 使用本地 HTTP 固定响应验证真实协议映射、流中取消、截断、响应上限和超时。运行 `node --test labs/05-streaming/openai.test.ts` 不需要密钥。真实付费验证由单独的运行入口及预算授权控制，不能从这些 fixture 推断已调用供应商。

协议依据：[OpenAI Responses 流式事件](https://developers.openai.com/api/reference/resources/responses/streaming-events)与[流式指南](https://developers.openai.com/api/docs/guides/streaming-responses)，核验日期 2026-10-30。

## 提交与评阅

提交函数差异、学生测试结果，以及一条“参数尚未闭合”和一条“监听器未完成”的轨迹。解释临时预览为什么不能直接进持久历史，事件消费者变慢会阻塞什么，取消信号为什么还必须传给产生流的 HTTP 请求。

参考实现没有工具执行权限，也不维护完整会话。它只返回最终 assistant 响应；主循环决定何时追加历史、执行工具。第 06 课再加入运行中的用户输入和取消控制。
