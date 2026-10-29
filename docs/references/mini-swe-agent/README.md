# mini-SWE-agent 只读源码摘录

这些完整文件用于课程 04 的源码对照，不参与 Node 实验，也不是另一个 Git 仓库。文件内容未改，只把扩展名改成 `.py.txt`，避免被误当成本课程的可运行程序。

上游：SWE-agent/mini-swe-agent。固定提交：`04d809ceab9df28f9adaed044884180159172930`。下载与核验日期：2026-10-30。授权为 MIT，版权声明与许可证见同目录 `LICENSE.md`。

| 本地文件 | 该提交的原始路径 | SHA-256 |
|---|---|---|
| default.py.txt | src/minisweagent/agents/default.py | e8ef8aa365942d739c2ec5cb0879f60f377d2dc2de8ec670aaedf3bafb45a4c2 |
| environments-local.py.txt | src/minisweagent/environments/local.py | 01dd33ae6be897458611911cc0eee1389092ea9fc6788c7eb24773e7c6342b1c |
| actions-toolcall.py.txt | src/minisweagent/models/utils/actions_toolcall.py | 47b666412e4f838508b50009cf34c7f63fe15e9e40affc257a17c0829896526f |

原始来源：

- https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/agents/default.py
- https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/environments/local.py
- https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/src/minisweagent/models/utils/actions_toolcall.py
- https://github.com/SWE-agent/mini-swe-agent/blob/04d809ceab9df28f9adaed044884180159172930/LICENSE

本课比较的事实范围是默认循环、原生 bash tool-call 解析与本地执行环境。源码存在其他模型适配器与环境实现；这三份文件不能代表全部运行模式。这里只做静态源码核验，没有运行 mini-SWE-agent 的任务或测量其效果。
