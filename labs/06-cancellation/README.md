# 06 · 中断与用户介入

实现两个位置：`InputQueue.drain` 决定输入何时生效，`runControlled` 把模型、工具和取消信号连起来。它们位于 `exercise.ts`；`solutions/06-cancellation.ts` 是独立参考答案。

```sh
npm run lab -- 06 test
npm run lab -- 06 verify
npm run lab -- 06 demo
```

直接入口分别是 `node --test labs/06-cancellation/exercise.test.ts`、加 `PI_TUTORIAL_REFERENCE=1` 的同一命令，以及 `node labs/06-cancellation/demo.ts`。初始学生检查应失败；参考检查通过不表示学生已完成。没有真实模型或付费调用。

## 契约

两类输入都按 FIFO 每次取一条。`turn` 边界只取 steering，`idle` 优先取 steering，否则取 follow-up。进入运行时可先取一条 steering；此后只在当前 assistant 和它的整批工具结果记录完成后取下一条。没有工具、没有 steering 时才取 follow-up。

同一个 `AbortSignal` 传给模型和执行器。运行前已取消时不发模型请求；模型等待中取消不记为成功回答；工具完成后发现取消时保留已有结果，并为本轮尚未执行的请求记录关联错误，不再启动它们。取消不会撤销已经写入的文件。本课返回 `cancelled`，不把它包装成 `completed`。

每次开始模型请求前递增 steps。工具错误进入工具反馈；未取消的模型异常向调用方抛出。`length` 响应不执行工具，补齐错误结果后以 `truncated` 返回。`maxSteps` 限制模型调用次数，队列里的任务也受该预算约束。

`onMessage` 是可选、被等待的消息监听器。监听器失败直接向调用方抛出；它不是持久化事务。需要可靠恢复时，下一课之后使用会话模块，而不是把“回调执行过”当成落盘保证。

## 评阅材料

提交学生代码、测试输出，以及一次“工具运行时 steer + follow-up”和一次“首个工具产生副作用后 abort”的消息轨迹。解释为什么 steering 不抢占当前批次，为什么取消后的历史仍可能包含一次成功写入，以及一个不响应 signal 的工具会怎样拖延结束。

参考实现尚未提供并行调度。第 07 课将用同一取消信号与输入边界加入多工具调度；输入队列本身仍然不负责执行工具。
