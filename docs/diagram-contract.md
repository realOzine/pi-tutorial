# 课程图示的数据契约

每课先显示完整架构中的位置，再显示本课的局部控制/数据流和可单步的数据变化，最后用两个方案的收益与代价解释架构选择。图是教学模型，不是实测或 pi 全部内部结构的复刻。使用已有课程事实，不新增未经核验的源码结论。

三个独立模块分别导出 `foundationDiagrams`（00–04）、`runtimeDiagrams`（05–08）、`stateDiagrams`（09–12）。每项结构如下；示例省略了部分步骤和状态项，完整数量约束见文末：

```js
{
  id: '00',
  focus: ['loop', 'model'],
  location: '整套 Agent → 消息边界 → 区分消息与结果',
  summary: '本课在完整架构中的具体职责和位置。',
  added: '本课新增或正在研究的机制。',
  deferred: '图里仍可见、但本课尚未展开的机制。',
  flow: {
    title: '具体局部过程',
    caption: '图中箭头承载什么，包含哪些简化。',
    nodes: [
      {id:'input', label:'收到消息', note:'unknown', col:0, row:0},
      {id:'check', label:'检查标签', note:'同进程函数调用', col:1, row:0},
    ],
    edges: [{id:'inspect', from:'input', to:'check', label:'role 与字段'}],
    steps: [
      {title:'检查前', nodes:['input'], edges:[],
       explanation:'此时知道什么，不知道什么。',
       changes:[{name:'类型知识',before:'unknown',after:'unknown'}]},
      {title:'检查后', nodes:['check'], edges:['inspect'],
       explanation:'状态为何变化。',
       changes:[{name:'类型知识',before:'unknown',after:'tool message'}]},
    ],
  },
  tradeoff: {
    decision:'决定点',
    chosen:{title:'课程选择',benefit:'解决的具体问题',cost:'具体代价'},
    alternative:{title:'另一方案',benefit:'何种条件下有价值',cost:'引入的复杂性或风险'},
    boundary:'何时值得改变这个选择。不能把教学取舍冒充作者动机。',
  },
}
```

全局组件 ID 固定：`input`（CLI 与用户输入）、`loop`（Agent 循环）、`model`（模型适配器）、`provider`（远端模型服务）、`tools`（校验/调度/执行）、`workspace`（文件与检查子进程）、`session`（日志和恢复）、`storage`（磁盘会话文件）、`context`（上下文视图）、`extensions`（资源/指令/hook）、`evaluation`（独立判定）。focus 表示本课关注，不代表其他模块此时全已实现。评测与循环可以处于同一个 Node 进程；独立指判定标准。

局部图用最多 8 个节点，`col` 为 0..2，`row` 为 0..2；同一坐标只放一个节点。节点 label 尽量不超过 12 个中文字符，note 不超过 22 字符。每条边有独立 id，每课 3–5 个步骤；步骤引用已定义节点/边，changes 为 2–3 组短的前后状态，值使用字符串。连接线标清“消息、函数调用、HTTP、I/O、取消信号”等具体含义，不能把函数模块画成独立服务。绘制与行为由根代理统一实现。

新模块只包含已读课程支持的 authored data；不改现有正文、练习或共享渲染器。数据文本继续遵循 readable-writing。中文写清事实/模拟/设计推断，尤其区分第 06 课的取消结果配对与第 12 课持久化未知状态。
