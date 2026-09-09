# V111-C · Word(docx) 应用内预览（docx-preview）

状态：TODO

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

（待实施）
