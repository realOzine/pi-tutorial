# 09 · 上下文管理

实现 `selectContext`。参数中的 `maxCharacters` 是 `JSON.stringify(messages).length` 的上限，计量单位为 JavaScript UTF-16 code unit，包含 JSON 协议字符；它不是 UTF-8 字节，也不是 provider token。系统提示与工具声明不在这个预算里，真实请求还必须计入它们。

```sh
npm run lab -- 09 test
npm run lab -- 09 verify
npm run lab -- 09 demo
```

直接命令：`PI_TUTORIAL_REFERENCE=1 node --test labs/09-context/exercise.test.ts`。学生 TODO 导致全部八项检查失败。参考演示用同一历史对比全量、裁剪和固定规则摘要，不调用真实模型。

全量模式原样返回，超预算标 `over_budget`。裁剪模式从最新用户轮次向前选择完整轮次；一个用户消息及直到下一用户消息之前的所有助手与工具消息属于一个轮次。当前轮次单独就超预算时，不能只留下工具结果，返回原历史并阻止请求。

摘要模式仅在全量超预算时执行，摘要最新用户轮次之前的材料；返回派生摘要和最近轮次，保留 `sourceIndexes`。失败返回 `summary_failed` 和原历史；结果太长返回 `over_budget`。调用者只有收到 `ready` 才可发送给模型。取消信号传给摘要器，取消仍向外抛出。

先完成全量与裁剪，再实现摘要和失败边界。保留输入原样；`keptIndexes`、`omittedIndexes` 都相对于本次输入，在持久会话中需映射为稳定记录 ID。提交三种策略对“端口 8080”约束的影响，并设计一个会被当前摘要器丢掉的新条件。
