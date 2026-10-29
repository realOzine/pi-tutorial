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
| 模型边界与消息转换 | [agent-loop.ts:390](zed://file/Users/ozine/Project/learn/pi/packages/agent/src/agent-loop.ts:390:1) | [streamAssistantResponse](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/agent/src/agent-loop.ts#L390) | 静态阅读；未验证真实 provider |
| SDK 组装依赖 | [sdk.ts:191](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/src/core/sdk.ts:191:1) | [createAgentSession](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/coding-agent/src/core/sdk.ts#L191) | 全文已读；不代表全部 AgentSession 实现已审计 |
| 实际包依赖 | [package.json](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/package.json:1:1) | [coding-agent package.json](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/coding-agent/package.json) | 已读；没有把 durable/chord 当作 coding-agent 必经层 |
| 当前 MCP 集成 | [mcp.md](zed://file/Users/ozine/Project/learn/pi/packages/coding-agent/docs/mcp.md:1:1) | [MCP 文档](https://github.com/earendil-works/pi/blob/1be312b46abe45d3914743a4d7837ebaf534d390/packages/coding-agent/docs/mcp.md) | 全文已读；文档描述，不是本课连接实测 |

在这个版本，`agent-loop.ts` 的核心执行路径可作为第 1 课参照，但教学实现没有复制它全部的调度、扩展和 provider 细节。课程采用的步数上限、固定模型和受限工具须标成教学设计。

### 后续课的源码候选

以下只确认到目录或文件入口，尚未完成相应课所需的整文件阅读和运行验证：

| 课程问题 | pi 内的候选位置 | 制作前要补的证据 |
|---|---|---|
| provider 适配 | `packages/ai/src/api/` | 选定模型后读适配器、请求映射和测试 |
| coding 工具 | `packages/coding-agent/src/core/tools/` | 每个工具的完整实现、边界和失败测试 |
| 会话与恢复 | `packages/coding-agent/src/core/session-manager.ts` | 文件格式、投影、分支、写入与恢复语义 |
| 上下文压缩 | `packages/coding-agent/src/core/compaction/` | 触发条件、摘要失败、原始记录保留和测试 |
| 扩展生命周期 | `packages/coding-agent/src/core/extensions/`、`resource-loader.ts` | 加载、执行顺序、错误与卸载行为 |
| 固定 provider 测试 | `packages/coding-agent/test/suite/harness.ts` | faux provider 契约和代表性测试全文 |
| 持久任务对照 | `packages/durable/` | 确认具体 API 状态、恢复承诺和适用边界 |

不能把候选位置写成已证实的调用链。新增课程引用时补固定文件链接、读取范围和实际运行记录。

## 外部资料

| 来源 | 本课程用来回答的问题 | 已知边界 |
|---|---|---|
| Mario Zechner，[What I learned building an opinionated and minimal coding agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)（2025-11-30） | 作者为何选择小核心、少量工具和可控上下文 | 历史作者陈述。文中的“No MCP support”不能代表本课固定源码版本 |
| Anthropic，[Building effective agents](https://www.anthropic.com/research/building-effective-agents)（2024-12-19） | 何时用预定义工作流，何时让模型选择下一步；增加自主性的成本 | 已查看官方页面。属于工程经验，不是所有任务上的比较定理；页面内容可能更新 |
| Anthropic，[Effective context engineering for AI agents](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents)（2025-09-29） | 如何选择每次请求携带的信息，如何在长任务中管理上下文 | 已查看官方页面。课程将用固定任务验证策略，不直接继承文章的效果判断 |
| Yao 等，[ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629v3)（v3，2023-03-10） | 动作与环境反馈为何能改变下一步决策 | 已核对摘要页与版本；实验与论文结果不能推广为本课程的实测，也不把私有模型思维当作可观察证据 |
| mini-SWE-agent，[v2 migration guide](https://mini-swe-agent.com/latest/advanced/v2_migration/) | 简单 bash 入口、工具协议和轨迹格式如何演进 | 已查看官方迁移文档。v2 默认原生 tool calling，旧版正则提取命令不代表当前默认；`latest` 会变化，专题前需固定源码 commit |
| DeepSeek，[Harness architecture](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) | 插件组合、事件、会话日志和模型上下文如何分工 | 已通过 GitHub 读取架构文档。不是全仓库审计；`master` 会变化，专题前需固定 commit 并核验实现 |

DeepSeek 架构文档此次返回的文件 blob SHA 为 `e3f5cd24a39d1d6275a291c83f165e6839ce191b`。它用于识别文档内容，不是仓库 commit，不能拿来假造整仓库的固定版本链接。

外部对比保持问题一致。例如第 2 课比较工具协议，第 8 课比较日志与恢复，第 10 课比较扩展边界。没有共同任务、配置和测量时，不给框架打总分，不复用宣传中的性能数字。Reddit 和个人讨论可作为问题线索；技术结论仍回到原始源码、作者材料或论文。

## 在每课中标注结论

- **源码事实**：给固定版本、函数和文件位置，描述可见控制流。
- **作者陈述**：给原文链接与日期，保留当时适用范围。
- **教学简化**：说明省略了哪些机制，以及何时补回。
- **设计推断**：明确是从约束推导出的解释，不冒充作者动机。
- **运行结果**：给命令、实现来源（学生或参考）、配置与产物；没有执行就写待验证。

记录 trace 时只保留教学需要的数据；真实凭据和敏感文件内容不得进入公开材料。页面中的状态图与模拟计时不会自动成为运行结果。
