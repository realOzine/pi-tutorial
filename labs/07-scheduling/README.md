# 07 · 多工具调度

补全 `exercise.ts` 的 `executeBatch`：先预检工具名和参数，再按执行声明选择整批串行或并行。独立参考实现位于 `solutions/07-scheduling.ts`。

```sh
npm run lab -- 07 test
npm run lab -- 07 verify
npm run lab -- 07 demo
```

直接入口是 `node --test labs/07-scheduling/exercise.test.ts`，参考验证加 `PI_TUTORIAL_REFERENCE=1`；演示为 `node labs/07-scheduling/demo.ts`。学生 TODO 初始应失败；参考检查和演示不调用真实模型。

## 契约

`executeBatch(calls, tools, signal, { execute, onResult? })` 返回按模型调用顺序排列的 `ToolMessage[]`。注入的 execute 与第 02 课 `executeToolCall` 同签名；调度器不重新实现工具运行逻辑。预检使用工具的纯 `validate`，执行器仍独立校验执行边界，因此组合后验证可能调用两次，不应在 validate 中产生副作用。

调用 ID 重复时整批拒绝，任何工具都不启动。所有预检先完成，未知工具或坏参数转为关联错误，获准的项继续执行。任何调用对应的工具声明 `sequential`，整批就顺序执行；否则允许全部获准项并行。不自动推断路径依赖，也没有无限任务队列或资源池。

`onResult` 按每项完成时调用并被等待；返回数组仍按原调用顺序。工具异常转为错误结果，不丢掉其他成功项。取消前未启动的项返回关联错误；已启动项拿到同一个 signal，并全部结算后才返回。若并行监听器抛错，也要等其他已启动操作结算再向上抛出。

## 观察与评阅

测试通过可控制 Promise 放行顺序，证明两个独立读取确实重叠；不以运行时间减少几个毫秒作结论。演示运行固定内存项目：先并行读取 README 与 config，再整批串行执行修改与检查；没有真实文件写入，也没有真实模型决策。

提交学生测试结果、完成事件顺序与最终返回顺序。再解释：一次写入声明 sequential 会损失哪些并发；一个读取工具被错误标记为 parallel 却改变共享状态，会破坏什么；取消后为什么必须等待已启动调用。完整文件、模型、流式与会话组合在毕业项目入口统一装配，各模块保持同一组共享契约。
