# V173-A · 数学模式引擎与符号条（D36）

**状态：** `TODO`

方案基准：`docs/v1.7.3-md-editor-formula-ux-plan.md` §5.1、§5.4 引擎部分、§6 规则 1/2、§7。

## 范围

- 新增纯函数模块 `src/renderer/math-input.ts`：`inMathMode(beforeCaret)`、`matchSnippet(beforeCaret)`（最长触发词优先）、`matchFractionAtom(beforeCaret)`、`nextSlotJump(afterCaret)`（空 `{}` → `}` → `$` 三级）、`MATH_SNIPPETS` 数据表（§5.1 全量，含原 `LATEX_SNIPPETS` 保留条目并入）；
- `md-editor.tsx`：`mathMode` state（focus 时 selectionchange 推导）；textarea keydown 接线——数学模式内空格触发展开（命中消费，未命中放行）、`/` 触发自动分式、Tab 槽位跳转（`isComposing` 期间全不拦截）；工具栏双态渲染（正文态现状微调 / 数学态 `.md-editor-math-bar` 符号条，chip 点击 = 展开插入 + 槽位定位）；全部走 `pushUndo` + rAF 光标；
- `styles.css`：`.md-editor-math-bar` 琥珀色符号条 + chip 样式（值抄示意稿 `math-bar`/`chip`）；
- 旧 `LATEX_SNIPPETS` 速查面板与 `latexPaletteOpen` 退役（导出表并入 `math-input.ts`，`v17-c-md-editor.test.ts` 引用处同步演进）。

## 不做

- 斜杠命令、Ctrl+M 快捷键（V173-B）；三视图/分栏/同步滚动（V173-C）；预览缓存/防抖/错误降级（V173-D）；
- 任何保存语义、IPC、Main、`AGENTS.md` 改动。

## 验收

- 新增 `tests/v1.7.3-formula-ux.test.ts` 第一批（§7 纯函数：数学模式侦测/最长匹配/词边界/自动分式原子判定/槽位跳转 + 静态渲染双态工具栏）；
- `v17-c-md-editor.test.ts` 速查面板断言演进为符号条断言；
- 开发窗口手工走查 §9.1–9.3；typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.7.3(V173-A): math mode engine and symbol bar`。
