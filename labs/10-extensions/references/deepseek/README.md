# DeepSeek Harness 阅读快照

来源仓库：<https://github.com/deepseek-ai/deepseek-harness>。

固定 commit：`f3803c96974ad4a94195fb97e5c637e9c2a3afe3`，2026-10-30 通过 `git ls-remote ... refs/heads/master` 核对，再使用该 commit 的 raw 地址下载，不以分支名作为后续引用基线。

- `agent-loop-index.ts.txt`：原文件 `packages/core/agent-loop/src/index.ts`，全文原样保存，838 行。只读参考，后缀用于避免加入课程 TypeScript 编译范围。网页代码跳转直接打开这份本地文件。
- `LICENSE`：该 commit 的 MIT 许可证，Copyright (c) 2026 DeepSeek。

原始固定源码地址：<https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/agent-loop/src/index.ts>。

SHA-256：源码 `8c2f579b21e482ecbca023341a79fdbc083124a3d8e1160bfd2f00136214a3c9`；许可证 `ebb4f09972aee8608be255debaf78451a68e95c290f55c240dec2ecfa16ea6be`。可用 `shasum -a 256` 复查。

本课完整静态阅读这一文件，核对服务注入、factory 注册、初始化与退出顺序；没有安装、构建或运行 DeepSeek Harness，也没有把此文件当作其整个循环实现。具体驱动还在它导入的 `agent.ts`，本课程没有复制或声称审计那个文件。
