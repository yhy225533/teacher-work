# V111-C · Word(docx) 应用内预览（docx-preview）

状态：DONE

## 目标

课件区/资料阅读器点开 .docx 资料直接在应用内渲染接近原版式的文档；.doc/.pptx/.xlsx 维持 unsupported（验收清单明示）。

## 前置产物

- V111-A/B（binary 合同 + 阅读器分支骨架）；`docs/v1.11-office-pdf-preview-plan.md` §5；D67。

## 任务内容

1. 依赖：`npm i docx-preview`（传递依赖 jszip）——依赖白名单内（D69）；
2. 新组件 `src/renderer/docx-preview.tsx`：`dataUrl → ArrayBuffer`；`renderAsync(buffer, container)` 到受控 div；卸载清空容器；渲染失败 → 上抛失败态；
3. `src/renderer/lesson-material-reader.tsx`：`binary` 且 docx MIME → DocxPreview（失败态逃生门同 V111-B）；
4. `src/renderer/styles.css`：`.docx-preview` 容器样式（限宽居中/白底/内部自适应）；
5. 测试：源码钉测（reader docx 分支、DocxPreview 组件结构、仅 docx 白名单断言、.doc/.pptx/.xlsx 仍 unsupported）。

## 门禁

相关测试 + typecheck + lint 全绿；PDF 分支（V111-B）零回归。

## 完成记录

2026-09-10 完成：

- **依赖**：`docx-preview ^0.4.0`（传递依赖 jszip；node 环境 import 干净，无需测试占位）；
- **组件**：`src/renderer/docx-preview.tsx`——静态 import `renderAsync`（渲染器边界禁 dynamic import，与 V111-B 同规则）；dataUrl → ArrayBuffer（复用 pdf-binary 的解码工具）→ `renderAsync(buffer, container, undefined, { inWrapper: true })`；卸载/重渲染前 `container.textContent = ''` 清空；失败态 inline-error；
- **接线**：`lesson-material-reader.tsx` 新增 `DOCX_MIME` 常量（与 Main 白名单一一对应）；binary + docx MIME → `<DocxPreview>` + 同款 `.pdf-preview-fallback` 逃生门；非 pdf/docx 的 binary（.doc/.pptx/.xlsx——Main 侧本就返回 unsupported，双重保险）→ 系统打开兜底；PDF 分支（V111-B）零改动；
- **样式**：`.docx-preview` 容器（灰底衬托 + 居中限宽 + docx-wrapper 尺寸约束 + section.docx 白底阴影）+ `.docx-preview-state`；
- **测试**：演进 `tests/v1.11-pdf-preview.test.ts`（10 例）——reader docx 分支结构 + DOCX_MIME 常量钉测、DocxPreview 静态导入 + 受控容器 + inWrapper 字面量 + 卸载清空、.doc 不进渲染分支双重钉住（renderer 常量 + Main 白名单）、依赖白名单（react-pdf + docx-preview）、docx 样式组；全量 97 files / 554 tests passed（553 + 1 skipped 既有）、typecheck、lint 全绿。
