# V112-A · docx 内嵌图片 CSP 修复（useBase64URL）

状态：DONE

## 目标

带内嵌图片的 docx 在工作台预览时图片正常显示（当前被 CSP `img-src 'self' data:` 拦截——docx-preview 默认生成 blob: URL）。

## 前置产物

- `docs/v1.12-external-preview-plan.md` §2.1/§8；D72（`implementation-tasks/V1_12_DECISIONS.md`）。

## 任务内容

1. `src/renderer/docx-preview.tsx`：`renderAsync` 第四参 options 加 `useBase64URL: true`（内嵌图 data: URL，CSP 已允许，零 CSP 改动）；
2. `tests/v1.11-pdf-preview.test.ts`（或新测试文件）：演进 docx 钉测——`useBase64URL: true` 字面量钉住 + 现有 `inWrapper: true` 断言保留；
3. 新增带图 docx fixture 测试：手写 zip 含 `word/media/image1.png`（最小 png）+ `word/_rels/document.xml.rels` 关系引用 + document.xml 内 `<w:drawing>` 引用——断言 fixture 字节结构可解析（Main 侧 readContent binary 往返），渲染端 data URL 行为经 V112-C 冒烟真实断言（node 测试无 DOM，不做渲染断言）；
4. 冒烟 fixture 准备（V112-C 用，本节点先把 buildDocx 扩展好或留待 V112-C——以最小实现为度）。

## 门禁

相关测试 + `npm run typecheck` + `npm run lint` 全绿。

## 完成记录

2026-09-10 完成：

- **修复**：`renderAsync` 选项加 `useBase64URL: true`（`src/renderer/docx-preview.tsx`）——内嵌图片 data: URL（CSP `img-src` 已允许 data:），默认 blob: URL 被 CSP 拦截的根因消除；CSP 零改动；组件头注释更新说明该约束。
- **测试**：新增 `tests/v1.12-docx-image.test.ts` 3 例——带图 docx fixture（手写 zip 含 word/media/image1.png 最小 PNG + rels rId1 引用 + w:drawing 标记）字节结构断言、readContent binary 完整往返（base64 逐字节还原含内嵌 png）、组件 useBase64URL/CSP img-src 钉测（blob: 不入白名单）；演进既有 V111-C 钉测（inWrapper 字面量 → inWrapper + useBase64URL 组合，禁旧字面量）。
- **门禁**：相关测试 13/13（含 v1.11-pdf-preview 全组）、typecheck、lint 全绿。渲染端真实 DOM 断言（图片元素 data: src）按测试分层约定留 V112-C 冒烟。
