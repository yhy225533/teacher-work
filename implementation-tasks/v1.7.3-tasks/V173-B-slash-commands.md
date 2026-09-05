# V173-B · 斜杠命令菜单与公式快捷键（D36）

**状态：** `TODO`

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
