# 10 · 指令与扩展

实现 `createExtensions`：只注册启用的扩展，拒绝工具重名；上下文 hook 按声明顺序串行处理上一个结果，失败阻止下一次模型请求；dispose 逆序清理，收集错误但继续清理，重复调用等待同一个 Promise。

```sh
npm run lab -- 10 test
npm run lab -- 10 verify
npm run lab -- 10 demo
```

直接检查：`PI_TUTORIAL_REFERENCE=1 node --test labs/10-extensions/exercise.test.ts`。学生起点前七项失败，最后一项是已提供的指令文本脚手架检查。`example.ts` 提供 `project_info` 工具及一个上下文提醒；demo 实际调用它们，不调用模型。

`Runtime.transformContext(messages, signal)` 返回本轮请求视图，不写原日志。参考实现复制一次输入，避免 hook 改坏持久消息；每次 hook 后检查工具关联。工具仍通过原来的声明、校验与执行链进入循环，指令文本不能绕开它。

扩展是同一个 Node 进程里的可信代码，并非隔离的权限边界。`enabled:false` 在启动装配时生效；dispose 后不再运行 hook 或扩展工具，但已发生的文件或网络副作用不会撤销。调用者先停止当前 Agent、等待在途工作结束，再清理扩展。本课不实现运行中热重载、下载插件或任意路径 import。

`composeInstructions(base, project, skills)` 只拼装显式提供的文本。它不会自动遍历文件系统、加载 skill 正文或安装工具。扩展调用路径与 MCP 进程/HTTP 路径的差异见网页教材。

`references/deepseek/` 是 MIT 许可的单个固定版本源码文件及许可证，专供 Zed 阅读，不参与编译或运行；来源和哈希见其 README。提交代码、测试输出和一次顺序交换的行为解释。
