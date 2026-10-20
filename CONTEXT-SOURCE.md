# 上下文整理模块的可视化接口（v1）

浏览器插件可以注入 `bubblingContextSources` 服务，注册一个可观察数据源。该接口只展示数据，不会把文本注入大模型；真实注入与来源证据由你的上下文整理模块负责。

```js
export const inject = ['bubblingContextSources'];
export function apply(ctx) {
  // 以下状态由你的上下文整理模块维护。
  let records = [];
  const listeners = new Set();
  const publish = next => {
    records = next;
    for (const notify of listeners) notify();
  };

  const unregister = ctx.bubblingContextSources.registerSource({
    version: 1,
    id: 'my-memory-manager',
    sessionId: '真实的 DSH 会话 ID',
    getSnapshot: () => records,
    subscribe: notify => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
  });
  ctx.effect(() => unregister);

  publish([{
    id: 'summary-001',
    afterNodeId: 'context:123', // 已加载的 DSH 节点 ID；不要照抄示例编号。
    title: '需求摘要',
    content: '由你的模块整理后的上下文文本',
    tokens: 120, // 可选；仅在确实有 tokenizer 测量值时填写。
    metadata: { source: 'requirements', revision: 1 },
  }]);
}
```

## 约定

- `id` 在同一数据源内唯一且稳定；重复发布同一 ID 更新原节点。
- `afterNodeId` 是当前会话中的原始节点 ID，例如 `user:42`、`context:123`、`tool:调用ID`、`assistant:轮次:步骤`。不能引用其他自定义记录。
- 分支数据源使用子 Agent 的真实 `sessionId`；主图订阅该分支后也会显示对应记录。
- 每个数据源返回完整快照；删除记录即从下一份数组移除。找不到挂载点时不伪造位置，主会话会显示提示。
- `content` 必须是字符串。省略 `tokens` 时，显示标记为 `≈` 的文本估算。
- 其他字段保留在节点原始详情中，便于将来增加检索、压缩、替代关系等信息。
- 注册返回卸载函数；插件卸载时应调用。无效快照显示错误，不替换成虚构记录。

纯数据辅助函数也通过包的 `./context-source` 导出，方便独立测试。以后增加关系边或新的数据形态时应升级协议版本，而非修改 v1 字段语义。
