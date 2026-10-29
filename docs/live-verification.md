# 真实模型验证记录

2026-10-30（Asia/Shanghai），使用用户授权的 `gpt-6.1-terra` 和本地 `secret`，通过官方 `https://api.openai.com/v1/responses` 验证。所有请求均使用 `reasoning.effort: none`、`store: false`；没有自动重试，也没有把密钥写入网页、Git 或下表产物。

| 验证 | 真实请求 | 输入 tokens | 输出 tokens | 实际结果 |
|---|---:|---:|---:|---|
| 最短连通探测 | 1 | 11 | 5 | HTTP 200，响应 completed，文本 OK |
| 第 03 课 MVP | 2 | 219 | 26 | 模型请求 read_file，收到关联结果后回答 npm run dev；文件内容来自内存教具 |
| 第 05/12 课流式编码与恢复 | 4 | 1682 | 183 | 真实读取、编辑、语法检查与回答；两个进程间恢复，编辑只执行一次 |
| 合计 | 7 | 1912 | 214 | 全部请求有完整响应，无未知用量请求 |

毕业项目第一次以 2 次调用为上限，模型读取 README.md 和 greeting.mjs，再通过 edit_file 补上结束反引号，状态为 `budget`。重新启动 CLI 后，模型调用 check_file，收到 `exitCode=0` 后回答，状态为 `completed`。两次运行共收到 107 次 SSE 预览事件；预览次数不是 token 数。随后离线检查了 JSONL、最终文件及 Node 语法结果：只有一次编辑请求，文件符合精确期望，语法检查通过。

本次验证是一次小型任务的集成证据，不能代表开放编码任务的成功率。`node --check` 只检查语法，没有运行被修改程序或功能测试。真实运行后又修正了 CLI 的无效配置资源清理、日志链接别名拒绝和用量完整性标记；这些修正通过本地回归验证，没有再次消耗付费模型。

## 费用

本次核对的 [OpenAI 官方模型页](https://developers.openai.com/api/docs/models/gpt-6.1-terra) 列出标准文本输入每百万 tokens $1、输出 $5。按普通输入单价粗估：

```text
(1912 × $1 + 214 × $5) / 1,000,000 = $0.002982
```

这约为 **$0.003**，远低于用户授权的 $40 总上限。它不是账户账单实扣；课程归一化 usage 没有保留每次请求的完整缓存计费分类，也没有查询账单接口。即便将全部输入按官方列出的较高缓存写入单价 $2.50/M 估算，本次总额仍低于 $0.01。后续验证以离线检查为主，不继续重复请求。

CLI 的次数、输入大小与输出 token 上限限制单次运行工作量，不是跨进程的美元预算管理器。中途失败可能已产生供应商费用；账本会保留 `unknown`。终端的 `knownUsage` 只累计已收到的完整响应，`usageComplete` 表示本次请求是否都拿到了完整 usage。

## 本机证据

产物位于被 Git 忽略的 `artifacts/`，由本机保留。此记录保存可核对的摘要；换机器克隆课程不会自动得到这些运行文件。

- `artifacts/api-probe.json`：短探测状态与原始 usage。
- `artifacts/live-mvp.json`、`artifacts/live-mvp-calls.json`：第 03 课消息和逐次用量。
- `artifacts/live-capstone/session.jsonl`：完整会话。
- `artifacts/live-capstone/session.jsonl.*.run.json`：两次进程的调用记录与预览次数。
- `artifacts/live-capstone/workspace/greeting.mjs`：实际修复后的文件。
- `artifacts/final-validation.json`：离线复核结果，以及 13 课学生起点检查和参考 demo 输出。

全部参考测试、网页链接检查和 GUI 覆盖范围见 [进度记录](progress.md)。默认检查和演示不读取密钥、不调用付费模型。
