# V111-B · PDF 应用内预览（react-pdf / pdfjs）

状态：TODO

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

（待实施）
