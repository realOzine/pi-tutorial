# 全课程实现约定

本轮完成 00—12 课的教材与实验。学生的核心函数保持 TODO；所有参考实现独立、可执行、可验证。完成教材不等于学生完成作业，也不等于真实模型效果已经验证。

第 01 课沿用已有最小契约。从第 02 课起使用 `labs/shared/contracts.ts`。这是为了让第 12 课组合前面实际运行过的模块，不要求先学完所有类型。

每课路径为 `labs/NN-slug/{exercise.ts,exercise.test.ts,demo.ts,README.md}`、`solutions/NN-slug.ts` 与 `site/lessons/NN-slug.html`。测试用顶层 import 同时导入学生与参考实现，通过 `PI_TUTORIAL_REFERENCE=1` 选择参考路径。演示默认调用独立参考实现，不调用付费 API。通用入口将是 `npm run lab -- NN test|verify|demo`。

每课包含具体问题、手工预测、可单步演示、源码调用路径、实验契约、递进提示、失败案例、取舍、自测与提交评阅要求。不要把大纲扩成几个段落就称作完成。实验 README 给出所有运行命令和初始失败原因。源码事实与教学简化写在相邻位置。源码引用先核验完整相关文件，页面代码链接一律指向最终路径的 `zed://file/绝对路径:行:列`。

新页面复用 `../assets/course.css` 与 `../assets/lesson-tools.mjs`。单步演示标记：

```html
<div class="simulator" data-walkthrough>
  <script type="application/json" class="walkthrough-data">
  {"scenarios":[{"id":"normal","label":"正常执行","steps":[
    {"title":"准备请求","detail":"这是教学模拟，不是计时数据。","state":{"history":[]}},
    {"title":"记录结果","detail":"解释这一变化为何发生。","state":{"history":["结果"]}}
  ]}]}
  </script>
</div>
```

公共脚本会创建场景选择、前后步、重置、说明与 JSON 状态展示。每课至少两个能说明不同决策的场景，明确标为教学模拟；不能用模拟展示宣称真实程序已运行。正文使用与第 01 课一致的 layout/sidebar/main 结构，保留跳过导航链接和清楚的标题。

各组只编辑自己编号的文件，独立小步提交。不要编辑全局目录、脚本、样式或其他组文件；需要改公共契约先联系主代理。所有临时 worktree 放在本仓库 `.worktrees/`，合并后移除。依赖沿用现有 TypeScript 与 Node API，不增加框架。
