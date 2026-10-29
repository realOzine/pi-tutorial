# 08 · 会话保存与恢复

实现 `exercise.ts` 的 `projectSession`：沿 `parentId` 读取选定分支；工具结果必须关联已有请求；未完成批次从模型历史中整体保留在外，但在 `pending` 返回仍未知的调用。函数不能执行工具。

```sh
npm run lab -- 08 test
npm run lab -- 08 verify
npm run lab -- 08 demo
```

也可直接运行：`PI_TUTORIAL_REFERENCE=1 node --test labs/08-sessions/exercise.test.ts`。学生起点的前五项测试因 TODO 失败，后面三项验证已提供的日志 I/O 脚手架，不代表学生通过。

参考 `solutions/08-sessions.ts` 提供 `openSession(path)`。文件目录由调用者创建；路径来自 CLI 操作者，不接受模型任意指定。`appendMessage` 同步追加并调用文件 `fsync`；`branch(id)` 只移动当前内存位置，随后追加的记录保存这个父节点。仅移动分支后直接退出，重开仍选择最后一条记录。

日志仅允许单个进程持有；没有跨进程锁或网络存储协议。`fsync` 不把文件修改与外部工具副作用合成事务，也不保证目录项在断电后一定存在。追加失败后原对象拒绝继续写入，应重新打开检查实际磁盘状态。

完整行损坏会报错。没有换行的尾部视为不完整记录：`recoverSession(source, newPath)` 只把之前的完整记录复制到新文件，保留原件，拒绝覆盖目标。即使最后一段恰好是合法 JSON，本课也要求换行才算完整记录。这是明确的教学约定，不声称与 pi 的容错策略一致。

演示实际创建并重开临时 JSONL 文件，结束后删除这个临时目录；不调用模型，不实际修改项目。提交学生代码、测试输出，并解释“磁盘没有工具结果”为什么既不能证明工具没运行，也不能证明工具成功。
