# 来源与版本边界

本清单让课程结论可以回到证据。源码描述“程序做什么”，作者文章描述“作者当时为什么这样选”，课程中的取舍分析可能是推断，实验结果则必须对应实际命令、配置和产物。四者分别标注，不互相代替。

查阅日期：2026-10-30。下面的“已读”均指静态阅读，不表示构建、运行测试或调用真实模型已经通过。课程验证记录另见 [进度记录](progress.md)。

## pi：固定源码参考

- 仓库：[earendil-works/pi](https://github.com/earendil-works/pi)。
- 固定 commit：`1be312b46abe45d3914743a4d7837ebaf534d390`。
- 本机只读位置：`/Users/ozine/Project/learn/pi`。相对于课程仓库根目录是 `../pi`。
- 本次读取的 `pi-agent-core` 和 `pi-coding-agent` package version 均为 `1.4.0`；引用以 commit 为准。
- 本地工作树以后可能更新。复查时先核对 revision，再使用本表行号；在线链接固定到 commit，不使用 `main` 充当固定版本。
- 网页中的代码跳转只用 Zed 链接：`zed://file/绝对路径:行:列`。本表 GitHub permalink 用于版本证据；本地路径与行号需随实际 checkout 核对。

| 用途 | 本地文件 | 固定在线链接 | 查阅边界 |
|---|---|---|---|
| 产品范围与包组织 | [README.md](zed://file/Users/ozine/Project/learn/pi/README.md:1:1) | [README](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/README.md) | 全文已读 |
| Agent 公共概念、队列与事件 | [agent README](zed://file/Users/ozine/Project/learn/pi/packages/agent/README.md:1:1) | [agent README](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/agent/README.md) | 全文已读；遇到示例与实现不一致时核对源码 |
| 消息、工具与事件类型 | [types.ts](zed://file/Users/ozine/Project/learn/pi/packages/agent/src/types.ts:1:1) | [types.ts](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/agent/src/types.ts) | 全文已读 |
| 状态、队列与运行生命周期 | [agent.ts:382](zed://file/Users/ozine/Project/learn/pi/packages/agent/src/agent.ts:382:1) | [Agent.prompt](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/agent/src/agent.ts#L382) | 全文已读；未执行对应测试 |
| 核心循环和工具执行 | [agent-loop.ts:172](zed://file/Users/ozine/Project/learn/pi/packages/agent/src/agent-loop.ts:172:1) | [runLoop](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/agent/src/agent-loop.ts#L172) | 全文已读；第 1 课主要映射入口 |
| 模型边界与消息转换 | [agent-loop.ts:390](zed://file/Users/ozine/Project/learn/pi/packages/agent/src/agent-loop.ts:390:1) | [streamAssistantResponse](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/agent/src/agent-loop.ts#L390) | 静态阅读；没有运行 pi 的 provider 链路，课程自有适配器另行验证 |
| SDK 组装依赖 | [sdk.ts:191](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/sdk.ts:191:1) | [createAgentSession](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/coding-agent/src/core/sdk.ts#L191) | 全文已读；不代表全部 AgentSession 实现已审计 |
| 实际包依赖 | [package.json](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/package.json:1:1) | [coding-agent package.json](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/coding-agent/package.json) | 已读；没有把 durable/chord 当作 coding-agent 必经层 |
| 当前 MCP 集成 | [mcp.md](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/docs/mcp.md:1:1) | [MCP 文档](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/coding-agent/docs/mcp.md) | 全文已读；文档描述，不是本课连接实测 |

在这个版本，`agent-loop.ts` 的核心执行路径可作为第 1 课参照，但教学实现没有复制它全部的调度、扩展和 provider 细节。课程采用的步数上限、固定模型和受限工具须标成教学设计。

### 后续机制的实际阅读范围

下面补充各课制作时完整静态阅读的文件。课程运行验证的是自己的实现；没有运行 pi 测试，也没有因为“已读”就宣称复现了 pi 的完整行为。

| 课程 | 已完整阅读的 pi 文件 | 课程采用的边界 |
|---|---|---|
| 03 · 模型协议 | [openai-responses.ts](zed://file/Users/ozine/Project/learn/pi/packages/ai/src/api/openai-responses.ts:1:1) | 对照请求与响应映射；课程只支持文本、函数工具和 `none` reasoning |
| 04 · 文件工具 | [read.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/tools/read.ts:1:1)、[write.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/tools/write.ts:1:1)、[edit.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/tools/edit.ts:1:1)、[bash.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/tools/bash.ts:1:1)、[file-mutation-queue.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/tools/file-mutation-queue.ts:1:1)、[edit-diff.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/tools/edit-diff.ts:1:1) | 对照输出限制、取消、同文件队列与匹配；课程严格替换，不开放任意 shell |
| 05—07 · 流、取消、调度 | 上表 `agent-loop.ts`、`agent.ts`、`types.ts` | 区分预览和提交、输入队列、并发执行及结果顺序 |
| 08 · 会话 | [session-manager.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/session-manager.ts:1:1)、[sessions.md](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/docs/sessions.md:1:1) | 对照分支投影与日志；课程对半写入尾行采用另存恢复，未知副作用需人工核对 |
| 09 · 上下文 | [compaction.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/compaction/compaction.ts:1:1) | 对照触发条件、摘要与保留记录；课程使用字符预算及固定摘要器，不冒充 token 计量或真实摘要质量 |
| 10 · 扩展 | [runner.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/extensions/runner.ts:1:1)、[resource-loader.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/resource-loader.ts:1:1) | 对照 hook、资源装配和生命周期；课程只装配显式提供的可信扩展 |
| 11 · 失败判定 | [harness.ts](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/test/suite/harness.ts:1:1)、[8935 取消回归](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/test/suite/regressions/8935-parallel-preflight-abort.test.ts:1:1)、[11227 恢复回归](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/test/suite/regressions/11227-recovery-omits-tool-results.test.ts:1:1) | 阅读 faux provider 和具体断言；课程固定评测另有自己的任务和判定器 |

这些文件与上表使用同一 pi commit。可在 [固定版本源码树](https://github.com/earendil-works/pi/tree/1be312b46abe45d3914743a4d7837ebaf534d390) 按路径核对。未列出的导入文件不因此成为已审计范围；`durable`、`chord` 不作为课程调用链或已验证的恢复方案。

## 两个固定版本的开源对照

### mini-SWE-agent：把动作集中在 bash

固定 commit：`04d809ceab9df28f9adaed044884180159172930`。第 04 课全文阅读三处源码：

- `src/minisweagent/agents/default.py`：查询、执行动作、反馈以及退出。
- `src/minisweagent/models/utils/actions/toolcall.py`：原生 bash 工具声明、参数解析、结果关联。
- `src/minisweagent/environments/local.py`：`shell=True` 的子进程执行、工作目录、环境和超时处理。

源码原样保存在 [本地快照](references/mini-swe-agent/README.md)，含 MIT 许可证、固定链接与 SHA-256。网页直接用 Zed 打开这些只读文本。对照说明“少量专用文件工具”和“一个通用 shell 入口”怎样改变能力与约束；没有安装、运行或评测 mini-SWE-agent，也没有把当前原生 tool calling 说成旧版正则提取。

### DeepSeek Harness：把装配交给服务与工厂

固定 commit：`f3803c96974ad4a94195fb97e5c637e9c2a3afe3`。第 10 课全文阅读 `packages/core/agent-loop/src/index.ts`，核对服务注入、工厂注册、初始化与退出顺序。[本地快照](../labs/10-extensions/references/deepseek/README.md) 保留源码、MIT 许可证和 SHA-256。

架构文档引用 [这个 commit 的 architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/architecture.md)。文档负责解释边界，实际事实回到已读装配文件。它导入的 `agent.ts` 未完整阅读；没有安装或运行 Harness，也不把一个文件的阅读写成整个运行时审计。

## 外部资料

| 来源 | 本课程用来回答的问题 | 已知边界 |
|---|---|---|
| Mario Zechner，[What I learned building an opinionated and minimal coding agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)（2025-11-30） | 作者为何选择小核心、少量工具和可控上下文 | 历史作者陈述。文中的“No MCP support”不能代表本课固定源码版本 |
| Anthropic，[Building effective agents](https://www.anthropic.com/research/building-effective-agents)（2024-12-19） | 何时用预定义工作流，何时让模型选择下一步；增加自主性的成本 | 已查看官方页面。属于工程经验，不是所有任务上的比较定理；页面内容可能更新 |
| Anthropic，[Effective context engineering for AI agents](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)（2025-09-29） | 如何选择每次请求携带的信息，如何在长任务中管理上下文 | 已查看官方页面。课程将用固定任务验证策略，不直接继承文章的效果判断 |
| Yao 等，[ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629v3)（v3，2023-03-10） | 动作与环境反馈为何能改变下一步决策 | 已核对摘要页与版本；实验与论文结果不能推广为本课程的实测，也不把私有模型思维当作可观察证据 |
| mini-SWE-agent，[v2 migration guide](https://mini-swe-agent.com/latest/advanced/v2_migration/) | 工具协议为何从旧版命令提取演进为原生调用 | 官方迁移说明；`latest` 会变化，课程实现结论以上述固定源码为准 |
| OpenAI，[gpt-6.1-terra 模型页](https://developers.openai.com/api/docs/models/gpt-6.1-terra)、[Function calling](https://developers.openai.com/api/docs/guides/function-calling) | 实际选定模型的 API 与函数调用消息如何对应 | 2026-10-30 核对官方协议；本模型工具调用使用 Responses API。课程仅实现明确说明的子集 |
| OpenAI，[Streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses)、[Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events) | 网络增量何时能提交为完整模型响应 | 官方事件定义；本地 HTTP fixture 与真实付费验证分别记录 |

外部对比保持问题一致。例如第 04 课比较执行工具边界，第 10 课比较扩展装配。没有共同任务、配置和测量时，不给框架打总分，不复用宣传中的性能数字。Reddit 和个人讨论可作为问题线索；技术结论仍回到原始源码、作者材料或论文。

## 在每课中标注结论

- **源码事实**：给固定版本、函数和文件位置，描述可见控制流。
- **作者陈述**：给原文链接与日期，保留当时适用范围。
- **教学简化**：说明省略了哪些机制，以及何时补回。
- **设计推断**：明确是从约束推导出的解释，不冒充作者动机。
- **运行结果**：给命令、实现来源（学生或参考）、配置与产物；没有执行就写待验证。

记录 trace 时只保留教学需要的数据；真实凭据和敏感文件内容不得进入公开材料。页面中的状态图与模拟计时不会自动成为运行结果。
