# 00 · 必要的 TypeScript

先读网页 `site/lessons/00-typescript.html`，再补全 `exercise.ts` 的两个函数。

```sh
npm run lab -- 00 test
npm run lab -- 00 demo
npm run lab -- 00 verify
```

`test` 检查学生实现，初始 TODO 会失败；`demo` 和 `verify` 运行独立参考实现，不说明学生已经完成。运行不需要 API key。

`describeMessage` 按 `role` 返回测试规定的说明，不为某种消息访问别种消息才有的字段。`runOperation` 在已取消时不启动操作，把同一信号传入操作；等待结束后取消优先，否则返回成功或普通失败。异常是 `unknown`，用 `instanceof Error` 取得消息，其他值用 `String`。

先用普通成功和异常实现，再处理调用前取消与等待期间取消。不要用 `Promise.race` 假装终止不理会信号的工作：本课明确等待操作返回，再判定状态。它不能撤销已经发生的副作用。

提交两个函数、测试结果和三句话：类型为何不能校验网络 JSON；`await` 为什么不等于创建线程；返回 `cancelled` 为什么不证明副作用消失。最后把 `LearningMessage` 临时增加一种种类，观察类型检查提醒在哪里，随后恢复这个小实验。
