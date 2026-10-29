# 11 · 评测与故障分析

实现 `evaluate`：所有案例都进入报告，运行器异常和判定器异常分别保留；完成状态与任务判定是两件事；未知费用与未知调用数不能当成 0。

```sh
npm run lab -- 11 test
npm run lab -- 11 verify
npm run lab -- 11 demo
```

直接检查：`PI_TUTORIAL_REFERENCE=1 node --test labs/11-evaluation/exercise.test.ts`。学生 TODO 导致全部六项失败。参考 demo 使用五个固定场景：历史约束保留、坏参数、当前轮次超限、本地可取消计时器超时、请求前取消。它实际调用课程的上下文与工具校验函数，但没有模型网络调用。

baseline 与 candidate 只改变上下文策略，分别使用 trim 与固定规则 summary。摘要器只是复制已知首条约束；`modelCalls=0` 是没有调用 LLM，而不是“Agent 零成本完成所有真实任务”。超时场景是本地计时器模拟 provider 等待，不是网络超时实测。

`passRate` 衡量判定规则是否满足；`completionRate` 衡量多少运行返回 completed。在正确拒绝坏参数的案例中，运行状态为 error，而判定可以通过。缺少 provider 价格与计量时 `costUsd=null`、`usage=null`；不能从缺字段推出费用或 token 用量为零。只有每一行都提供计量时才汇总相应字段，逐行已知值仍保留。

准备版本化报告时先提交代码，再运行 `COURSE_REVISION=$(git rev-parse HEAD) npm run lab -- 11 demo`；只在工作树无修改时把这个 revision 作为完整证据。默认写明 working-tree 未固定。数据集版本、配置、provider、model、时间、逐案轨迹与失败都要保留。

本课运行器按顺序执行，不提供强制终止任意不合作代码的隔离器；每个真实模型与工具适配器应有自己的取消/超时。提交实现与全部报告，再补一个现有判定器会误判的反例，不只展示通过率。
