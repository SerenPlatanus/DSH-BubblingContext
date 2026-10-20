# BubblingContext

DSH 轨迹与上下文可视化插件。当前版本实现顶部工具栏入口与原生右侧面板；尚未采集轨迹或调用模型。

## 当前功能

- 会话右上角气泡按钮，位于“在应用中打开”左侧。
- 点击打开 BubblingContext 右侧标签页；重复点击聚焦面板。
- 支持 DSH 原生关闭、缩放、全屏及会话隔离。
- 空面板明确标注轨迹数据尚未接入。

## 开发与安装

需要 Node.js >=22.19。本插件构建零外部依赖，React 由 DSH 提供。

```bash
npm run build
dsh plugin --profile web add /home/platanus/DSH-BubblingContext
```

安装后刷新 DSH 页面；若未启用配置热更新，则重启 DSH。
当前开发目标为 DSH 0.2.0-rc.2；其他版本尚未验证。

## 文件

- `src/index.js`：宿主入口。
- `src/client.cjs`：按钮与面板，使用 DSH 公共 Slot / Sidebar API。
- `scripts/build.mjs`：生成 DSH 惰性客户端 bundle。
- `lib/client.js`：构建产物，随仓库交付，便于直接加载。
- `cordis.patch.yml`：安装到 Profile 的配置层。

下一阶段：确定气泡数据模型，对接会话轨迹，再逐步加入筛选与详情。
