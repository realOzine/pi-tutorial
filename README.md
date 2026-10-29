# 从最小循环开始学习 Agent

这门课程用 TypeScript 逐步搭建一个本地 coding agent，并沿 pi 的源码解释每个机制解决的问题、约束和代价。00—12 共 13 课，每课都有 HTML 讲解、单步场景、学生练习、检查和独立参考实现。先观察“读取 README → 收到工具结果 → 再次请求模型”，再逐步加入真实 HTTP、文件修改、流式输出、取消、调度、会话、上下文和扩展。

## 开始学习

需要 Node.js 22.19.0 或更新版本，以及 npm。在本仓库根目录运行：

```sh
npm install --ignore-scripts
npm run dev
```

浏览器打开 [课程首页](http://127.0.0.1:4173/)。不熟悉 TypeScript 时从第 00 课开始；能读对象、联合类型和 `async/await` 时，从第 01 课的最小循环开始。本地服务绑定 `127.0.0.1:4173`，只提供 `site/` 内的静态文件。

先读页面、预测轨迹，再补全本课学生函数。除第 01 课使用 `loop.ts` 外，学生入口均为 `labs/NN-主题/exercise.ts`。命令中的 `NN` 换成 `00` 到 `12`：

```sh
npm run lab -- 01 test     # 检查学生实现；初始 TODO 应失败
npm run lab -- 01 demo     # 观察独立参考实现
npm run lab -- 01 verify   # 检查独立参考实现
```

`demo` 和 `verify` 默认不调用付费模型。参考检查通过不代表学生已完成；初始检查中可能通过的是脚手架或拒绝路径。不要用答案覆盖学生文件来让检查变绿。完成一课应提交代码差异、实际输出，以及“解决了什么问题、付出什么代价、何时该换方案”的说明，具体见 [评阅约定](docs/review-guide.md)。

## 三个可以运行的里程碑

| 阶段 | 运行入口 | 可以观察什么 |
|---|---|---|
| 03 · 最小 MVP | `npm run lab -- 03 demo` | 同一循环通过 `Model` 接口接收响应、执行工具、回传结果；默认使用固定模型 |
| 07 · 交互式文件修改 | `node labs/07-scheduling/coding-demo.ts --interactive` | 输入 `/start`；实际读取、编辑并检查课程文件；用 `/steer`、`/follow`、`/stop` 观察输入边界 |
| 12 · 可恢复 Agent | `npm run lab -- 12 demo` | 修改真实练习文件，达到步数上限后重开日志，继续检查，独立验收最终文件 |

第 07 课保留文件和 trace，默认模型按固定规则工作。第 12 课把前面的模块装配成 CLI，支持指定 workspace、会话文件、扩展和上下文预算；完整命令见 [毕业项目说明](labs/12-capstone/README.md)。循环返回 `completed` 只表示没有下一步工作，任务是否成功仍要检查实际文件与检查器结果。

真实模型入口必须显式启用。课程提供 OpenAI Responses 的文本与函数调用适配，以及第 05 课的 SSE 流适配；使用 `gpt-6.1-terra`、reasoning effort `none`，不覆盖整个 Responses API。密钥只在本地读取，不放进网页、trace 或 Git。每次真实运行的模型、请求量、用量和验证范围见 [进度记录](docs/progress.md)；本地 HTTP fixture 测试不能替代供应商实测。

## 内容和源码

所有课程内容由这一个 Git 仓库追踪：

```text
pi-tutorial/
  site/        HTML、样式、单步演示与课程地图
  labs/        学生实现、共享契约、固定场景和实验检查
  solutions/   独立参考解答
  docs/        大纲、来源、评阅和验证记录
  scripts/     本地预览与课程检查
  tests/       课程基础设施检查
  artifacts/   本地实验产物；不纳入 Git
```

完整学习路线见 [课程大纲](docs/curriculum.md)。pi 是只读源码参考，固定到 `1be312b46abe45d3914743a4d7837ebaf534d390`。第 04 课对照 mini-SWE-agent 的 bash 入口，第 10 课对照 DeepSeek Harness 的服务与工厂装配；引用范围和固定快照见 [来源清单](docs/sources.md)。没有运行或测量的项目，不宣称它的性能或任务成功率。

网页代码跳转统一为 `zed://file/绝对路径:行:列`。pi 指向 `/Users/ozine/Project/learn/pi/`，课程代码指向 `/Users/ozine/Project/learn/pi-tutorial/`，不指向临时 worktree。换电脑时需要更新本地路径；来源清单保留固定 commit 链接，便于核对版本。

文件工具适用于可信、稳定的本地实验目录：拒绝越界路径和链接，只提供读取、写入、精确替换和 Node 语法检查。工作目录不是操作系统 sandbox；课程也不提供任意 shell、跨进程日志锁或副作用恰好执行一次的保证。

维护课程时运行 `npm run check`，单独检查全部参考实验可运行 `npm run lab -- all verify`。已执行的检查、真实调用和未完成的视觉验证分别记录在 [进度记录](docs/progress.md)。
