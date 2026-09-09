# V111-A · readContent binary 合同扩展

状态：DONE

## 目标

既有 `files:read-content` 通道响应合同新增 `binary` 分支（dataUrl 载荷，与 image 分支同构），Main 按 mime 白名单（application/pdf + docx）+ 12MB 上限返回；渲染端与守卫面同步演进。

## 前置产物

- `docs/v1.11-office-pdf-preview-plan.md` §3；D68。

## 任务内容

1. `src/shared/file-contracts.ts`：`ManagedFileContent` 加 `{ file, kind: 'binary', dataUrl }` 分支；`isManagedFileContent` 守卫加 binary 判定（isNonEmptyString(dataUrl) 且 `data:` 前缀）；
2. `src/main/files/managed-file-service.ts` `readContent`：image/text 判定之后、unsupported 之前，对 `application/pdf` 与 docx MIME 且未超限的文件返回 binary dataUrl；其余路径零改动；
3. 测试：`tests/managed-file-service.test.ts` 新增 binary 往返（pdf/docx fixture 各一：kind/dataUrl 前缀与内容非空）+ 超限 pdf 仍 unsupported + image/text/unsupported 零回归断言；`tests/file-ipc.test.ts` readContent 往返补 binary 守卫断言（含伪造 dataUrl 拒绝）；
4. 渲染端暂不消费（接线属 V111-B/C）——本节点只有合同与 Main 侧。

## 门禁

相关测试 + typecheck + lint 全绿；readContent 既有三分支行为逐字节不变。

## 完成记录

2026-09-10 完成：

- **合同**：`file-contracts.ts` 的 `ManagedFileContent` 加 `{ file, kind: 'binary', dataUrl }` 分支（与 image 同构，附 D68 注释）；`isManagedFileContent` 守卫加 binary 判定（isNonEmptyString + `data:` 前缀，伪造前缀拒绝）；
- **Main**：`managed-file-service.readContent` 在 image/text 之后、unsupported 之前插入 `isPreviewableBinary` 白名单分支（application/pdf + docx MIME，12MB 上限沿用超限 unsupported 路径）；其余四个路径逐字节不变；
- **测试**：新增 `tests/v1.11-readcontent-binary.test.ts` 5 例——pdf/docx binary 往返（dataUrl 前缀 + 字节级 base64 还原）、.doc/.pptx/.bin 仍 unsupported、image/text/超限三分支零回归（超限 pdf 显式覆盖）、伪造 binary 载荷守卫拒绝（http 前缀/空串/data: 合法三态）。docx fixture 为测试内零依赖手写最小 zip（crc32 + local/central 目录结构）；
- **门禁**：全量 96 files / 544 tests passed（543 + 1 skipped 既有）、typecheck、lint 全绿。
