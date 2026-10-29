# 03：真实模型适配器

学生补全 `exercise.ts` 的请求转换与响应校验。HTTP 请求、超时、取消和 1 MiB 响应限制由 `transport.ts` 提供；参考映射在 `solutions/03-model-adapter.ts`。使用 Node 自带 fetch，不增加 SDK 依赖。

```sh
npm run lab -- 03 test
npm run lab -- 03 verify
npm run lab -- 03 demo
```

默认 demo 使用固定模型；verify 启动本机临时 HTTP 服务，实际走 POST、鉴权头、序列化、响应体读取、取消与错误路径，不联系 OpenAI，也不使用真实凭据。学生 TODO 的映射测试初始失败；纯 HTTP 边界测试有些可能通过，因为它们检查公共脚手架。

适配器使用 **OpenAI Responses API**，模型保持用户指定的 `gpt-6.1-terra`。请求固定 `reasoning.effort: none`、`store: false`，支持文本与自定义函数工具。它不是完整 Responses SDK：不支持推理项、图片或托管工具。返回不支持的项时明确报错，不静默丢掉它们。模型是否支持 none 必须按官方文档核对。

函数调用使用 `function_call.call_id`，不是输出项 `id`；结果映射为 `function_call_output`。完整回复的非法 JSON 参数是适配协议错误；输出预算导致的半截参数只作为证据保留，交给循环逐调用返回“未执行”的错误。usage 必须有非负整数的 input/output token，不编造 0。

`mvp.ts` 用一个循环组合第 02 课执行器和任意 Model：收到工具调用后执行、追加结果、再请求；累计真实报告用量。`length` 返回 truncated，不伪装 completed；maxSteps 只限制模型请求次数，不代表金额上限。

真实调用需要用户显式选择并设置环境变量，不把密钥写进命令历史、页面或 Git：

```sh
export OPENAI_MODEL=gpt-6.1-terra
# OPENAI_API_KEY 已由你的本地密钥管理方式设置后，再执行：
node labs/03-model-adapter/demo.ts --live
```

这条命令最多请求 3 次、每次最多输出 256 token；输入与实际计费仍取决于服务。调用前确认账户预算。HTTP 429、超时、格式错误不自动重试，避免未经决策的重复成本。超时不是服务端没有产生费用的证明。

提交请求映射、响应映射和检查输出。真实实验另记日期、精确模型、调用数、provider usage、结束原因与失败样本；离线 fixture 只能证明协议代码，不能证明模型会正确选工具。官方依据：

- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/models/gpt-6.1-terra

课程讲解中的 API 事实核验于 2026-10-30；不要按旧博客假定这个模型的工具调用可走 Chat Completions。
