# V111-B · PDF 应用内预览（react-pdf / pdfjs）

状态：DONE

## 目标

课件区/资料阅读器点开 PDF 资料直接在应用内渲染（连续滚动分页），失败/超限仍有「用系统应用打开」逃生门；`binary` 合同首个消费方落地。

## 前置产物

- V111-A（binary 合同）；`docs/v1.11-office-pdf-preview-plan.md` §4；D66。

## 任务内容

1. 依赖：`npm i react-pdf`（携 pdfjs-dist）——本版依赖白名单内（D69）；
2. 新组件 `src/renderer/pdf-preview.tsx`：worker 配置（`GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`，与本组件同模块）；`dataUrl → Uint8Array` 工具；`<Document>` 加载 + `<Page>` 连续滚动、宽度适配；onLoadError → 上抛失败态；
3. `src/renderer/lesson-material-reader.tsx`：渲染分支 `content?.kind === 'binary' && file.mimeType === 'application/pdf'` → PdfPreview（失败态 inline-error + 既有 onOpenFile 逃生门）；
4. `src/renderer/styles.css`：`.pdf-preview` 样式组（页白底/间距/阴影/窄窗适配）；
5. 测试：源码钉测（reader binary 分支结构、PdfPreview 组件结构、worker 配置字面量、白名单依赖断言）；既有 unsupported/编辑态钉测演进。

## 门禁

相关测试 + typecheck + lint + production build（worker 资产产出必须实跑验证）全绿；md/图片/unsupported 分支零回归。

## 完成记录

2026-09-10 完成：

- **依赖**：`react-pdf ^10.5.0`（携 pdfjs-dist，npm 镜像源安装；package.json 依赖白名单钉测确认无额外直接依赖）；
- **组件**：`src/renderer/pdf-preview.tsx`——静态 import（渲染器边界禁 dynamic import，见下）`Document/Page/pdfjs`；worker 经 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` 与组件同模块配置；`dataUrlToUint8Array` 工具独立在 `pdf-binary.ts`（无 DOM 依赖）；ResizeObserver 自适应阅读器栏宽；`renderTextLayer/renderAnnotationLayer` 均关（无链接跳转面）；连续滚动分页 + 渲染态文案；
- **接线**：`lesson-material-reader.tsx` 新增 binary 分支——pdf MIME → `<PdfPreview>` + `.pdf-preview-fallback`（"需要打印或另存？"→「用系统应用打开」逃生门）；非 pdf binary → unsupported 同款兜底（V111-C 前 docx 走此路）；text/image/unsupported 三分支零改动；
- **测试基建**：pdfjs-dist ESM 模块级引用 DOMMatrix（node 无此全局）——`tests/setup-node-dom-stubs.ts` 提供占位并经 `vitest.config.ts` setupFiles 注入（纯测试基建，零断言参与）；初版 React.lazy 动态导入方案被 `renderer-boundary` 测试正确拒绝（dynamic import 禁令为冻结安全规则），改为静态导入 + 测试占位；
- **样式**：`.pdf-preview` 样式组（页白底/阴影/间距/滚动）+ `.pdf-preview-fallback`；
- **测试**：新增 `tests/v1.11-pdf-preview.test.ts` 7 例——reader binary 分支结构、静态导入 + worker 配置字面量、双 layer 关闭、setup 基建钉测、解码工具、依赖白名单、样式、Main 白名单（.doc 不在）；全量 97 files / 551 tests passed（550 + 1 skipped 既有）；
- **门禁**：typecheck、lint、production build 全绿（`pdf.worker.min-*.mjs` 1.26MB 资产实跑产出验证）。
