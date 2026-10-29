# 12 · 把各层接成一个可恢复的编码 Agent

你要完成 `exercise.ts` 的 `runAgent`。前面各课提供工具协议、文件工具、流式模型、输入队列、调度、日志、上下文和扩展；这一课决定它们的调用顺序，以及出错后留下什么证据。`solutions/12-capstone.ts` 是独立参考，不会替换你的作业。

```sh
npm run lab -- 12 test     # 学生实现；初始 TODO 应失败
npm run lab -- 12 verify   # 参考实现与 CLI 集成检查；不联网
npm run lab -- 12 demo     # 真文件修复，停止后重新打开日志；固定规则模型
```

## 自己运行一个会话

在仓库根目录执行，换一个尚未使用的实验目录：

```sh
node labs/12-capstone/cli.ts --reference \
  --workspace artifacts/my-agent/workspace \
  --session artifacts/my-agent/session.jsonl --init --steps 2

node labs/12-capstone/cli.ts --reference \
  --workspace artifacts/my-agent/workspace \
  --session artifacts/my-agent/session.jsonl
```

第一次在第 2 次模型响应后停下，文件已改，状态为 `budget`。第二次从完整工具结果继续检查，最终 `completed`；已有编辑只执行一次。删除 `--reference` 就会使用你的 `runAgent`。`--init` 只允许空目录；日志放在 workspace 外，工具不能修改它。

运行时可以输入 `/steer 请先检查`、`/follow 解释检查边界`、`/stop`。固定规则模型只能演示预设任务，不理解任意自然语言；测试中的另一组模型验证队列顺序。真实模型才能用于开放任务。

## 显式接入真实模型

以下命令**会调用付费 API**。密钥文件必须在 workspace 外，不要提交它；也可设置 `OPENAI_API_KEY`。必须使用新的实验目录，或去掉 `--init` 恢复原会话。

```sh
node labs/12-capstone/cli.ts --reference \
  --workspace artifacts/live-example/workspace \
  --session artifacts/live-example/session.jsonl \
  --init --live --key-file secret --steps 6
```

CLI 固定使用 `gpt-6.1-terra`，走第 05 课的真实 Responses SSE 适配。每次最多 512 输出 tokens，单请求序列化输入最多 24 KB，本次最多 8 次请求，30 秒超时，无自动重试。这些限制约束工作量，不是供应商账单的硬美元上限。请求开始前写入独立 `*.run.json`；收到完整 usage 后更新，网络失败则保留 `unknown`，不会伪造零费用。

`--no-extension` 关闭项目扩展；`--context 128..24000` 调整请求视图的字符预算。原始 JSONL 不随裁剪而删除。`--help` 列出全部参数。教程只允许可信、稳定的本地目录；`check_file` 只运行 Node 语法检查，不运行被修改的程序。

## 验收顺序

1. 先实现无工具响应，确认完成后不会在恢复时再次主动请求模型。
2. 接上工具批次：先持久化 assistant 请求，再执行工具，全部结束后按请求顺序持久化结果。
3. 在同一位置接入 steering 和 follow-up，不能把用户消息塞进半个工具批次。
4. 在请求前生成上下文视图；预算不够就停，不删除日志，也不启动 API。
5. 取消与恢复：写入可能已经发生而结果未落盘时，当次返回 `cancelled`，恢复时返回 `needs_review`。读者需检查文件并决定新建任务或分支；本课不自动重放未知副作用。

提交练习时保留失败输出，并解释一次正常轨迹和一次失败轨迹。关键问题：日志里“发生过请求”与“确认完成副作用”分别由什么记录证明？为什么不能用最终回答作为任务成功的判据？
