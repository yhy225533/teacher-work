# V173-D · 预览管线：公式缓存、错误降级与防抖（D37）

**状态：** `TODO`

方案基准：`docs/v1.7.3-md-editor-formula-ux-plan.md` §5.4、§7。

## 范围

- `lesson-material-reader.tsx` `MathSpan`：模块级 `Map` LRU 缓存（键 = displayMode+串，上限 300，命中重插队尾）；`throwOnError: true` + try/catch，失败输出 `.math-error`（红色 + `title` 原串）；`parseBlocks`/`renderInline` 结构不动；
- `md-editor.tsx`：预览渲染 120ms 防抖（`debouncedPreview` state；保存/恢复草稿/卸载立即同步；热保存 250ms 与保存路径不动）；
- `styles.css`：`.math-error` 样式（值抄示意稿 math-fallback）。

## 不做

- 公式悬浮预览浮窗（D38 不排期）；`parseBlocks` 重构、渲染进程外渲染、Main/IPC 改动。

## 验收

- `v1.7.3-formula-ux.test.ts` 第四批：缓存命中不重渲、LRU 淘汰、错误公式 `math-error` 与消息断言、防抖纯逻辑（timer 行为）；
- `v17-c` 既有渲染测试回归通过；手工走查 §9.7（长文档体感 + 坏公式红色提示）；
- typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.7.3(V173-D): math cache, error fallback and preview debounce`。
