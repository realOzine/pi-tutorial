# 02：工具协议

先阅读 HTML 的“坏参数为什么不能直接执行”。本课由内存文件提供结果，不访问磁盘，不调用模型 API。

```sh
npm run lab -- 02 test
npm run lab -- 02 verify
npm run lab -- 02 demo
```

也可直接运行 `node --test labs/02-tool-protocol/exercise.test.ts`；参考检查在命令前设置 `PI_TUTORIAL_REFERENCE=1`。学生入口 `exercise.ts` 的两个函数都保留 TODO，初始测试失败是预期。

`executeToolCall` 先查工具，再验证参数，再调用工具。成功、未知工具、错误参数与执行异常都保留原 call ID；错误标记为 `isError: true`。工具名称重复不能任选一个。取消信号是循环控制，必须向调用者抛出，不转换成让模型重试的失败反馈。

`executeResponseTools` 拒绝重复调用 ID；响应以 `length` 结束时，给每个调用生成未执行的错误结果，即使参数恰好能解析也不能执行。正常响应按调用顺序执行。后续第 07 课会增加并发。

这里的声明是 JSON Schema 数据，真正检查由 `Tool.validate` 完成。示例只接受 `{ path: 非空字符串 }`；没有实现通用 JSON Schema 引擎。声明、校验和业务检查必须保持一致。路径的文件系统边界属于第 04 课。

提交学生代码、测试输出，并解释：为什么合法 JSON 仍可能不能执行？为什么 `length` 是整条响应的限制，不能只检查最后一个调用？用未知工具→错误反馈→更正名称这条轨迹说明恢复机制。
