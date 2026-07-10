---
description: 数据面板（中间栏下侧）窗口标题栏双击缩放与拖拽拉伸
---

当为本项目开发/调整构件模块（梁、柱、楼梯、板等）的 `中间栏下侧数据面板窗口` 时，按以下规范实现统一的自由缩放交互：

1. **标题栏交互**
   - 窗口标题区域使用 `cursor: pointer`。
   - 绑定 `onDoubleClick` 事件，调用 `toggleExpand` 切换窗口的“普通/放大”状态。
   - 标题栏仅显示标题文字，**不放置** 缩放按钮（-/+）和 “展开/收起” 按钮。
   - 放大状态提示：`title={expanded ? '双击还原' : '双击放大'}`。

2. **放大状态实现**
   - 普通状态：使用 `flex-1` 或 `w-1/3` 等布局类，作为 flex 流中的一部分。
   - 放大状态：使用 `position: fixed` 固定在屏幕右下角（或左下角），宽度/高度由 `size` 状态控制。
   - 在放大状态下，保留一个 `w-1/3` 或 `flex-1` 的占位 `<div aria-hidden />`，防止布局塌陷。
   - 放大窗口边框：使用 `1px solid rgba(0,218,243,0.25)` 和深色背景，与框架梁/柱模块保持一致。

3. **拖拽拉伸**
   - 放大窗口的左上角（或右上角）放置一个 20×20 的透明拖拽角，cursor 为 `nw-resize`（左上角）或 `ne-resize`（右上角）。
   - 拖拽角绑定 `onMouseDown={onResizeStart}`，实现鼠标拖拽调整窗口大小。
   - 最小尺寸限制：通常宽度 ≥ 220，高度 ≥ 180。

4. **内容缩放与平移**
   - 内容区域监听 `onWheel`，可通过滚轮缩放视图（系数范围建议 0.5 ~ 5）。
   - 采用乘法缩放：每滚轮一格缩放约 12%，即 `factor = e.deltaY < 0 ? 1.12 : 1 / 1.12`，避免线性缩放步长过大。
   - 缩放通过 `transform: translate(${pan.x}px, ${pan.y}px) scale(${zoom})` 作用于内容容器实现。
   - 内容区域监听 `onMouseDown` / `onMouseMove` / `onMouseUp` / `onMouseLeave`，左键拖动时平移视图（pan）。
   - cursor 状态：平时 `grab`，拖动时 `grabbing`，内容区域加 `select-none` 避免选中文本。

5. **参考实现**
   - 框架梁：参考 `src/ui/data/BeamDataContent.tsx` 中的 `SectionView` / `QuantitiesTable`。
   - 柱：参考 `src/ui/data/ColumnDataContent.tsx` 中的 `ColumnSectionView` / `ColumnQuantitiesTable`。
   - 楼梯：参考 `src/ui/data/StairDataContent.tsx` 中的 `StairQuantitiesTable` / `StairSectionView`。

6. **默认行为**
   - 在实现任何新的构件数据面板时，若面板位于中间栏下侧，默认采用此交互模式。
   - 仅当用户明确要求不同的缩放/展开方式时，才偏离此规范。
