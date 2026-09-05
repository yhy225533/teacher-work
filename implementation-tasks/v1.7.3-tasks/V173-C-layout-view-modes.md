# V173-C · 布局方案 A：三视图、可拖分栏与同步滚动（D37）

**状态：** `TODO`

方案基准：`docs/v1.7.3-md-editor-formula-ux-plan.md` §5.3、§6 规则 5/6、§7。

## 范围

- `md-editor.tsx`：`viewMode`（edit/split/preview，默认 split）+ `splitRatio`（0.25–0.80 钳制）state；三视图分段控件（复用既有 `.segmented-control` 风格或同值新类）；split 态渲染 6px 拖动条（pointer 事件，拖动期间 `syncPaused` + 禁 textarea 捕获）；每 fileId localStorage 记忆（`md-editor-view:{id}` / `md-editor-split:{id}`，容错回退）；
- 同步滚动：编辑侧 `onScroll` → 行比例单向联动预览（§5.3 公式）；预览侧滚动后 800ms 抑制反向（规则 6）；切视图/拖动不触发；
- `styles.css`：三视图容器 grid 动态列、拖动条（col-resize）、edit/preview 单栏态样式；
- footer 提示文案随三视图/新交互更新（§9 走查项）。

## 不做

- 块锚点同步滚动、沉浸模式/左侧栏隐藏（D37/D38：后期增量，本任务仅保证布局不写死依赖左侧栏）；V173-B/D 范围。

## 验收

- `v1.7.3-formula-ux.test.ts` 第三批：视图/比例记忆读写与钳制纯逻辑、默认 split 静态断言、拖动条 aria、`v17-c-md-editor.test.ts` 分屏断言演进；
- 手工走查 §9.6（含刷新记忆恢复）；typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.7.3(V173-C): view modes, draggable split and sync scroll`。
