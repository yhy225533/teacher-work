# V112-B · 外部资料预览通道与面板 UI

状态：TODO

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

（待实施）
