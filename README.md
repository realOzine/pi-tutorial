# 从最小循环开始学习 Agent

这门课程用 TypeScript 逐步搭建一个本地 coding agent，并以 pi 的源码解释每一步为什么需要这样设计。每课从一个具体问题开始：先预测执行过程，再观察消息和工具调用，最后补全关键代码、运行检查并讨论取舍。

首期实现第 1 课的 HTML 讲解、实验脚手架和独立参考解答。第 0 课和第 2—12 课目前只有课程规划；运行与页面验证结果记录在 [进度记录](docs/progress.md)，不以大纲中的验收目标代替实际结果。

## 开始第 1 课

需要 Node.js 22.19.0 或更新版本，以及 npm。在本仓库根目录运行：

```sh
npm install --ignore-scripts
npm run dev
```

浏览器打开 [课程首页](http://127.0.0.1:4173/) 或 [第 1 课](http://127.0.0.1:4173/lessons/01-agent-loop.html)。本地服务默认绑定 `127.0.0.1:4173`，只提供 `site/` 内的静态文件。

先阅读页面，再在 Zed 中补全 [学生循环](zed://file/Users/ozine/Project/learn/pi-tutorial/labs/01-agent-loop/loop.ts:1:1)，然后运行：

```sh
npm run lab:01:test
```

初始代码保留 TODO，学生检查预期失败。这是练习起点；不要用参考答案覆盖学生文件来让检查变绿。检查通过后，仍需解释消息顺序、停止条件和工具失败后的行为。

若要先观察完整流程，可单独运行参考解答：

```sh
npm run lab:01:demo -- --scenario readme --trace artifacts/lesson-01.json
```

它执行课程提供的确定性场景并输出 trace，即按时间记录的执行轨迹。输出属于参考实现，不能证明学生代码已经完成，也不是真实模型的推理记录。运行产物放在被 Git 忽略的 `artifacts/`；页面演示、导入轨迹和真实模型实验的边界见 [评阅约定](docs/review-guide.md)。

维护课程时运行：

```sh
npm run check
```

该命令检查课程工程，并使用独立参考实现验证实验契约；学生是否完成练习由 `npm run lab:01:test` 单独判断。第 1 课不需要 API key，也不调用付费模型。真实模型接入属于尚未实现的第 3 课。

## 内容组织

所有课程内容都在一个 Git 仓库中。以下是普通子目录，不是独立仓库：

```text
pi-tutorial/
  site/        HTML、样式和交互演示
  labs/        学生实现、固定场景和实验检查
  solutions/   独立参考解答
  docs/        大纲、来源、评阅和进度记录
  scripts/     本地预览与课程检查
  tests/       课程基础设施的测试
  artifacts/   本地执行轨迹；不纳入 Git
```

pi 源码是只读参考，不复制成学生答案，也不在学习过程中修改。课程固定参考版本 `1be312b46abe45d3914743a4d7837ebaf534d390`；本机位置与在线永久链接见 [来源清单](docs/sources.md)。

网页中的代码跳转都使用 `zed://file/绝对路径:行:列`，直接打开 Zed。pi 链接指向 `/Users/ozine/Project/learn/pi/`，课程代码指向 `/Users/ozine/Project/learn/pi-tutorial/`；换电脑时需要更新这些本地路径。GitHub commit 链接保留在来源清单中作版本证据。

完整路线见 [课程大纲](docs/curriculum.md)。第 3 课形成最小 MVP，第 7 课形成可交互的 coding agent，第 12 课完成会话恢复、扩展与评测。毕业项目只在限定实验目录中工作；达到课程验收不等于已经适合不受限的生产环境。

学生负责循环、调度、上下文等核心逻辑；课程提供协议、固定场景、检查和逐步提示。评阅既看运行结果，也看能否解释设计约束和代价。后续课程在完成第 1 课学习反馈后逐课制作，不一次性生成所有答案。
