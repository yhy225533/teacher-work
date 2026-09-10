# V1.12 决策记录（外部资料应用内预览 + docx 内嵌图片修复）

- 日期：2026-09-10
- 背景：V1.11 交付后产品负责人实测两问题——①带内嵌图片的 docx 图片不显示（CSP 拦 blob: URL）；②外部资料页无预览能力（V1.1 纯元数据面板）。授权合并实施为 V1.12。
- 设计基准：`docs/v1.12-external-preview-plan.md`

## D70 · 外部资料预览走单条新通道 `external-library:read-preview`，载荷与 ManagedFileContent 四分支同构但 file 字段换轻量元数据

- 请求复用既有 `ExternalPathRequest`（rootId + relativePath，守卫不动）；
- 响应 `ExternalFilePreview` 四分支 text/image/binary/unsupported 同构 V1.11 合同——渲染端组件（PdfPreview/DocxPreview/MarkdownDocument/img）全部复用；
- **不把外部文件桥接成 managed 记录**（不写 files 表）：桥接会让预览产生副作用（登记/索引/备份面），违背"外部资料只读"红线；轻量元数据（name/mimeType/sizeBytes）足以驱动 UI；
- MIME 按扩展名推导（与 managed 侧 knownTypes 同表语义），12MB 上限沿用；
- 路径安全完全复用 `resolveEntry`（realpath + within-root + R_OK），不新增任何路径逻辑；
- 备选否决：①改 `files:read-content` 接受 relativePath——污染既有合同语义（fileId 查询 vs 路径查询混在一个通道），且 managed 服务不应知道外部资料根目录；②Renderer 直接 file:// 读——违反渲染器边界红线，直接否决。

## D71 · 外部资料面板「预览优先」：选中即预览、操作行保留、V1.1 元数据卡退役为不可预览态

- 选中可预览文件（text/image/pdf/docx 按扩展名白名单）即渲染预览区，复用课次阅读器组件栈（MarkdownDocument/md 文本、img/image、PdfPreview/pdf、DocxPreview/docx）；
- 操作行零改动（保存到素材库/用于本次备课/打开文件/所在文件夹）——预览与动作正交；
- 不可预览扩展名（.doc/.pptx/.xlsx 等）保留元数据卡 + 新说明文案；文件夹选中不触发预览；
- pdf/docx 预览下带「需要打印或另存？→ 打开文件」逃生门（与课次阅读器一致）；
- V1.1 说明「不模拟高保真显示」退役（与现状不符——V1.11 后工作台确实能预览了）；
- 备课跳转模式（pick overlay）同生效：挑资料时当场看内容。

## D72 · docx 内嵌图片：`useBase64URL: true` 走 data: URL，CSP 零改动

- 根因：docx-preview 默认 `blobToURL` 返回 `URL.createObjectURL(blob)`（blob: URL），CSP `img-src 'self' data:` 不含 blob: → 图片全被拦；
- 修法：`renderAsync` 选项 `useBase64URL: true` → 内嵌图 data: URL（CSP 已允许）；不改 CSP（放宽 blob: 到 img-src 是更大的攻击面，没必要）；
- data URL 随 DOM 释放，无 blob URL 手动 revoke 的泄漏面；
- 备选否决：CSP `img-src` 加 `blob:`——攻击面扩大（任何 blob 可当图源），且不解决内存管理，否决。
