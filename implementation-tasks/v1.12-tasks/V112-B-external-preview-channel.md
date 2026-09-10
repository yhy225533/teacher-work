# V112-B · 外部资料预览通道与面板 UI

状态：DONE

## 目标

外部资料页（独立导航 + 备课跳转两处挂载点）对已登记根目录内文件直接预览，不复制不导入不改原文件。

## 前置产物

- V112-A 完成；`docs/v1.12-external-preview-plan.md` §3/§4/§5；D70/D71。

## 任务内容

1. **合同**（`src/shared/external-library-contracts.ts`）：`ExternalFilePreview` 四分支（text/image|binary 共形态/unsupported），轻量元数据 `{ name, mimeType, sizeBytes }`（无 fileId）+ 守卫 `isExternalFilePreview`；
2. **通道**（`src/shared/ipc-contracts.ts`）：`EXTERNAL_LIBRARY_IPC_CHANNELS` 加 `readPreview: 'external-library:read-preview'`；
3. **Main**：
   - `ExternalLibraryService.readPreview(rootId, relativePath)`：复用 `resolveEntry` 解析（realpath + within-root + R_OK），statSync 大小判定（>12MB → unsupported 超限提示），扩展名→MIME 映射（与 managed `knownTypes` 同表），按 V1.11 readContent 同语义分支返回（text/image/binary/unsupported）；
   - `external-library-ipc.ts`：case readPreview（assertRequest `isExternalPathRequest` → ensureResponse `isExternalFilePreview`）；
4. **preload**：`externalLibrary.readPreview(request)` 接线（守卫过滤）；
5. **Renderer**（`external-library-panel.tsx`）：
   - 选中文件（kind === 'file' 且扩展名在预览白名单）→ useEffect 请求 readPreview → 预览区渲染（复用 MarkdownDocument / img / PdfPreview / DocxPreview）+ 操作行保留 + pdf/docx 逃生门；
   - 不可预览扩展名 → 保留元数据卡 + 新说明文案；文件夹选中不预览；
   - 加载/失败态（inline-error + 打开文件按钮可用）；V1.1 说明文案退役；
6. **样式**：`.external-preview` 容器组（限宽、滚动、与 external-content-panel 适配）；
7. **测试**：Main readPreview 单测（in-memory service：text/image/binary/超限/不可预览/越界路径拒绝/rootId 不匹配）+ IPC dispatch case + 守卫 + renderer 源码钉测（组件复用分支结构 + 静态导入）。

## 门禁

相关测试 + `npm run typecheck` + `npm run lint` 全绿；课次资料阅读器（V1.11 链路）零回归（相关既有测试全绿）。

## 完成记录

2026-09-10 完成：

- **合同**（external-library-contracts.ts）：ExternalFilePreview 四分支（text/image|binary 共形态/unsupported）+ ExternalPreviewMeta 轻量元数据（name/mimeType/sizeBytes，无 fileId——外部文件不在 files 表）+ isExternalFilePreview 守卫（dataUrl 要求 data: 前缀拒伪造、message 限长、sizeBytes 安全整数）。
- **通道**（ipc-contracts.ts）：EXTERNAL_LIBRARY_IPC_CHANNELS.readPreview = 'external-library:read-preview'（第八通道，唯一新增）。
- **Main**：ExternalLibraryService.readPreview——resolveEntry 复用（realpath + within-root + R_OK 零新路径逻辑）、12MB 上限沿用（超限 unsupported 提示）、externalMimeTypeForName 扩展名推导（与 managed knownTypes 同表）、isExternalPreviewableBinary 与 managed isPreviewableBinary 同语义（仅 pdf/docx 进 binary，.doc 等走 unsupported）；IPC case readPreview（assertRequest isExternalPathRequest → ensureResponse isExternalFilePreview）；纯只读零登记零广播。
- **preload + preload-api**：readPreview 接线 + 守卫导入/re-export + 类型声明（误放 import 块经 typecheck 修正——verbatimModuleSyntax type-only 约束）。
- **Renderer**（external-library-panel.tsx）：选中文件 useEffect 拉取 readPreview（isPreviewableExtension 渲染端白名单与 Main 表一致；文件夹/不可预览扩展名不触发）；ExternalEntryDetails 预览化——text+md → MarkdownDocument（files=[]，外部 md 无托管文件引用解析面）、text 纯文本 → pre、image → img、binary+pdf → PdfPreview + 逃生门、binary+docx → DocxPreview + 逃生门、unsupported → 提示；操作行零改动；V1.1 说明「不模拟高保真显示」退役；元数据行的类型/大小用预览载荷反哺（mimeType 真实值优先）。
- **样式**：.external-preview 容器组（限滚动 + markdown/pre/img 白底阴影 + 复用 pdf/docx 容器 margin）。
- **测试**：新增 tests/v1.12-external-preview.test.ts 12 例——service 四分支（md/txt text、png image、pdf/docx binary、.doc unsupported、超限、越界/rootId 不匹配/文件夹拒绝）、守卫伪造三态、IPC dispatch（成功载荷 + 非法载荷/文件不存在 + 响应不含路径）、渲染端钉测（静态导入复用组件、四分支渲染字面量、逃生门、V1.1 说明退役、PREVIEWABLE_EXTENSIONS 精确集合断言、Main 白名单函数体钉测、preload 接线）；初次 4 失败均为钉测自身缺陷（fixture 无 workspace 返回值/fileIcon 合法提及 .doc/推导表必需 msword）修正后全绿。
- **门禁**：全量 98 files / 568 tests（567 + 1 skip 既有）、typecheck、lint 全绿。
