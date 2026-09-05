# V173-B · 斜杠命令菜单与公式快捷键（D36）

**状态：** `DONE`

方案基准：`docs/v1.7.3-md-editor-formula-ux-plan.md` §5.2、§6 规则 3/4、§7。

## 范围

- `SLASH_ITEMS` 数据（§5.2 表，含 `\u0000` 光标占位符语义）进 `math-input.ts`（或同模块旁挂）；菜单打开状态 `slashMenuOpen` + 过滤词；
- `md-editor.tsx`：空行（trim 空）输入 `/` 或 `、` 触发；菜单 markup（`.md-editor-slash-menu`：过滤行 + 列表项 nm/py/插入预览，值抄示意稿）；↑↓ 循环选中、Enter 插入首项/选中项、点击插入、Esc/blur 关闭；插入剥 `\u0000` 落光标，其后空 `{}` 优先；非空行 `/` 正常输入；`compositionend` 后才应用过滤；菜单打开期间空格不被缩写引擎拦截（菜单优先）；
- 快捷键：`Ctrl+M` 块级 `$$\n␚\n$$`、`Ctrl+Shift+M` 行内 `$␚$`（选中包裹，共用插入函数，仅编辑器 focus 生效）；
- `styles.css`：`.md-editor-slash-menu` 系列样式（定位/上翻、选中态、py 灰字，值抄示意稿 slash-menu）。

## 不做

- 沉浸模式、块锚点滚动、KaTeX 宏（D38 明确不做/后续版本）；V173-C/D 范围；逻辑/IPC 改动。

## 验收

- `v1.7.3-formula-ux.test.ts` 第二批：斜杠过滤纯函数（拼音/中文/英文 startsWith）、占位符剥离与光标计算、静态渲染菜单 markup 与互斥规则；快捷键接线断言；
- 手工走查 §9.4/9.5；typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.7.3(V173-B): slash command menu and formula hotkeys`。

## 完成记录（2026-09-05）

- 斜杠数据与纯函数已在 V173-A 随 math-input.ts 落地（SLASH_ITEMS 12 项 / SLASH_CURSOR / filterSlashItems / resolveSlashInsert / isSlashLineStart）；本任务接线 md-editor：`slashMenu` state（query+activeIndex，随光标 selectionchange 跟随查询、超出 12 字符或离行自动关闭）；空行 `/` 唤出、中文顿号 `、` 空行时改写为 `/` 唤出（非空行正常输入）；↑↓ 循环导航、Enter 插入选中项、Esc 关闭、blur 延迟 120ms 关闭（避开点击竞态）；菜单打开期间空格不被缩写引擎拦截（菜单优先分支在前）。
- `insertSlashItem`：从 `/` 起到光标整段替换模板（resolveSlashInsert 剥占位符、其后空 {} 优先槽位），pushUndo 入栈、rAF 光标定位。
- 快捷键：Ctrl/Cmd+M 块级 $$…$$、Ctrl/Cmd+Shift+M 行内 $…$（选中包裹），共用 insertTemplate。
- CSS：斜杠菜单全套（过滤行 + 闪烁光标 + 列表 is-active + 拼音列 + 插入预览 + 空态）。
- 测试：v1.7.3-formula-ux 追加 3 例（触发与导航接线 / 快捷键与共用插入 / undo 栈与占位符光标），共 14 例通过；typecheck、lint 通过。
