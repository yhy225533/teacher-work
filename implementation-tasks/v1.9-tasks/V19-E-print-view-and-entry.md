# V19-E · 打印视图与课件区入口

状态：DONE

## 目标

打印视图（复用 `MarkdownDocument` 所见即所得）+ 课件区「导出 PDF」入口 + A4 打印版式落地。Main 侧零改动（消费 V19-D 通道）。

## 前置产物

- V19-D 全部通道与服务（`window.teacherWorkbench.export.*`）；
- **V19-B 合并工具行**（入口位置 = 工具行三主键之一，`⬇ 导出 PDF` 在本节点接线后才渲染）；
- 既有可复用：`MarkdownDocument`（`lesson-material-reader.tsx` 导出，含 KaTeX 渲染与 `ManagedMarkdownImage` data URL 图片）、`katex/dist/katex.min.css` 导入先例、`lesson-files-section.tsx` 阅读器接线模式、`link-button` / `inline-notice` / `inline-error` 样式。

## 任务内容

1. `src/renderer/main.tsx`：`location.search` 检测 `?print=1` → 渲染 `PrintDocumentView`（包 RendererErrorBoundary），不渲染 App（不进 overview/路由/全局导航）；
2. `src/renderer/print-document-view.tsx`（新）：
   - 挂载后 invoke `export.getPrintPayload()` → `{ bodyMd, files, meta }`；
   - 复用 `MarkdownDocument`（body + files）渲染 + 引入 `print-document.css`；
   - 就绪协议：`document.fonts.ready` + 等待全部 `<img>` complete（复用 `ManagedMarkdownImage` 加载路径，失败占位不阻断）→ invoke `export.printReady()`；
   - 载荷失败显示最小错误态（正文不重试、无其他 UI）；
3. `src/renderer/print-document.css`（新）：A4 版式（方案 §5）——正文约 11pt、标题层级缩放、`.material-math-display` / 图片 / `table` / `pre` / `blockquote` `break-inside: avoid`、`h1–h6` `break-after: avoid`、图片 `max-width:100%`；仅打印窗加载，主窗 `styles.css` 零改动；
4. `src/renderer/lesson-material-reader.tsx`：header 操作行新增「导出 PDF」`link-button`——仅 `selectedFile.mimeType === 'text/markdown'` 且传入 `onExportPdf` 时显示；导出中显示「导出中…」禁用态；结果提示走既有 `inline-notice`（成功「已导出：文件名.pdf」/取消「已取消」）与 `inline-error`；
5. `src/renderer/lesson-files-section.tsx`：接线导出 handler——`exportBusy` 状态 + 调 `window.teacherWorkbench.export.printToPdf({ fileId, lessonId, headerText })`；headerText = 「学生名 · 课次标题」显示串（一对一取关联学生，班课取课次标题；拼装复用既有 overview 数据，≤100 字）；
6. `src/renderer/styles.css`：仅按钮禁用态/提示补充（复用 link-button 为主）；
7. `tests/v1.9-export-ui.test.ts`（新）：
   - 入口显示条件（md 显示、非 md 不显示、无 handler 不显示）；
   - busy 禁用态与「导出中…」文案；
   - 成功/取消/失败提示分支；
   - `?print=1` 分支渲染 PrintDocumentView 而非 App 的静态钉测；
   - print-ready 协议（fake preload：payload → 渲染 → ready 调用序）；
   - headerText 拼装规则。

## 边界

- 不改 `MarkdownDocument` / `parseBlocks` / `renderInline` / `ManagedMarkdownImage` 的任何渲染语义（打印视图只消费）；
- 主窗 App、路由、导航、备课工作台零变化（除阅读器入口）；
- 不改 V19-D 已冻结的通道与服务；不新增 IPC/依赖；
- 阅读器既有「✎ 编辑 / 系统打开 / 所在文件夹 / 从本课移除 / MinerU / 设为讲义底稿」入口全部不动。

## 验证

- 相关测试 + `npm run typecheck` + `npm run lint`。

## 完成记录

2026-09-08 完成（Main 侧零改动，消费 V19-D 通道）：

- `src/renderer/main.tsx`：`new URLSearchParams(window.location.search).get('print') === '1'` → `<PrintDocumentView />`（包 RendererErrorBoundary），否则 `<App />`——主窗加载路径零变化。
- `src/renderer/print-document-view.tsx`（新）：挂载 invoke `export.getPrintPayload()` → 失败最小错误态「导出载荷读取失败，本次导出已中止。」（不重试）；成功复用 `MarkdownDocument`（body + files 所见即所得，KaTeX/题图与阅读器一致）；就绪协议 = `document.fonts.ready` + `waitForAllImages`（全部 `<img>` load/error 即就绪——失败占位不阻断）→ invoke `export.printReady()`；就绪探测失败不阻断（Main 60s 超时兜底）。
- `src/renderer/print-document.css`（新）：A4 版式（正文 11pt、标题层级缩放、微软雅黑字体栈、`.material-math-display`/`.material-markdown-image`/`table`/`pre`/`blockquote` break-inside avoid、h1–h6 break-after avoid、图片 max-width:100%、白底黑字）；无自动封面（D53）；仅打印窗加载，主窗 styles.css 零改动。
- `src/renderer/lesson-files-section.tsx`：V19-B 占位注释 → 真实「⬇ 导出 PDF」按钮——非只读分支三主键位（disabled = busy/exportBusy/非 md，title 引导「仅支持导出 Markdown 文件」）；只读分支导出 + ⋯；`exportSelectedPdf` 调 `window.teacherWorkbench.export.printToPdf({ fileId, lessonId, headerText })`（请求只带 id/显示串）；busy 文案「导出中…」；结果提示 success 「已导出：原名.pdf」/取消「已取消导出。」/失败走既有 inline-error；`exportHeaderText` = 一对一「学生名 · 课次标题」、班课课次标题、`Array.from(...).slice(0, 100)` 截断。
- `tests/v1.9-export-ui.test.ts`（新 7 例）：?print=1 分支与主窗零变化/打印视图载荷→渲染→就绪协议与最小错误态/A4 版式规则钉死/入口 md 门 + busy 文案 + 结果分支/headerText 拼装规则/只读分支导出+⋯/冻结入口零回归；演进 `tests/v1.9-courseware-toolbar.test.ts` 1 处（占位注释钉测 → 真实按钮钉测，验收语义不变：三主键 + 沉浸 + ⋯）。
- 门禁：全量 91 files / 519 tests（1 skip 既有）+ typecheck + lint 全绿。
