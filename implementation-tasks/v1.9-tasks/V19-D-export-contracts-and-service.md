# V19-D · 导出合同、IPC 与 Main 导出服务

状态：DONE

## 目标

建立导出合同、三条 `export:*` IPC 白名单通道与 Main `ExportService`（校验、载荷组装、隐藏打印窗编排、printToPDF、保存端口、超时清理）。Renderer 侧零 UI 改动（入口属 V19-E，挂在 V19-B 落地的课件区工具行）。

## 前置产物

- `docs/v1.9-pdf-export-plan.md`（设计基准）
- `implementation-tasks/V1_9_DECISIONS.md` D48–D54
- 既有可复用：`windowWebPreferences` / `applyWindowNavigationGuard`（`src/main/window-security.ts`）、`extractIpcSender` sender 收窄（`src/main/ipc/ai-ipc.ts` / `draft-ipc.ts` 先例）、`ManagedFileService` 文件读取与挂课关系查询、原生对话框注入端口模式（`chooseSourcePath` / `chooseTranscript` / `chooseBackupDestination`）、临时文件 + 原子重命名写入先例、ipc-contracts 白名单注册/注销模式。

## 任务内容

1. `src/shared/export-contracts.ts`（新）：
   - 常量：`EXPORT_HEADER_TEXT_MAX_CHARS = 100`、`EXPORT_BODY_MD_MAX_CHARS = 200_000`（与 write-version 同限）、`EXPORT_TOTAL_TIMEOUT_MS = 60_000`；
   - 接口与守卫：`ExportPrintRequest`（fileId + lessonId + headerText?）/ `ExportPrintResult`（saved: boolean）、`ExportPrintPayload`（bodyMd + files + meta）/ `PrintReadyResult`（accepted: true）；
2. `src/shared/ipc-contracts.ts`：`EXPORT_IPC_CHANNELS` 三条（`export:print-to-pdf` / `export:get-print-payload` / `export:print-ready`）+ `IpcChannel` 联合扩展 + `EXPORT_ERROR` 错误码（`EXPORT_BUSY` / `EXPORT_TIMEOUT` / `EXPORT_ERROR`）；
3. `src/shared/preload-api.ts` + `src/preload/index.ts`：`export` 命名空间（`printToPdf` / `getPrintPayload` / `printReady`）+ Preload runtime guards；
4. `src/main/export/export-service.ts`（新）：`exportLessonPdf` 编排——
   - 校验：fileId 为 active managed 文件且 `text/markdown`；lessonId 存在且文件确挂该课次；headerText ≤ 100 字；已有导出进行中 → `EXPORT_BUSY`（单导出串行）；
   - 载荷组装（不信任 Renderer 传内容）：bodyMd 由 Main 直读 managed 对象正文；files = 该课次全部 active managed 文件清单；meta = { title（原名去扩展名）, headerText, exportDate }；
   - 隐藏打印窗：`windowWebPreferences` + preload + 导航守卫 + `show:false`，加载 `index.html?print=1`；记录本次 webContents.id 供 sender 校验；
   - 就绪等待：收 `print-ready` 后调用 `webContents.printToPDF`（A4 纵向、margins 上下 0.63"/左右 0.55"、`displayHeaderFooter` + headerTemplate/footerTemplate、`printBackground:false`）；60s 总超时、窗口 crash（render-process-gone 等）→ 销毁 + `EXPORT_TIMEOUT` / `EXPORT_ERROR`；
   - 保存：注入端口 `chooseSavePath`（默认名 = 原名 `.md`→`.pdf`；取消 → 返回 `saved:false` 不报错）→ 同目录临时文件 + 原子重命名（占用/失败 → 稳定错误 + 清理，不留半成品）→ `shell.showItemInFolder`（注入端口）；
   - 响应只含 `{ saved: boolean }`，不回传路径（V11-01 边界）；结束后销毁打印窗；
5. `src/main/ipc/export-ipc.ts`（新）：三条通道白名单分发；`export:get-print-payload` / `export:print-ready` 仅接受当前打印窗 sender（extractIpcSender 比对 webContents.id）；`print-ready` 只允许一次；
6. `src/main/index.ts`：注册/注销 export IPC、注入 `chooseSavePath`（`dialog.showSaveDialog`，主窗为 parent）与 `showInFolder` 端口、before-quit 清理打印窗与服务引用；
7. 测试：
   - `tests/export-contracts.test.ts`（新）：守卫正反例（headerText 边界、hasOnlyKeys、saved 布尔）；
   - `tests/export-service.test.ts`（新）：以注入 fake（假窗口创建端口、假 printToPDF、假对话框端口、假文件写盘）覆盖——成功保存原子重命名与默认名、取消 `saved:false`、占用稳定错误、超时清理、并发 BUSY、payload 组装只含本课文件；
   - `tests/export-ipc.test.ts`（新）：白名单注册/注销、sender 校验拒绝非打印窗调用、错误映射、载荷守卫。

## 边界

- 不改 `MarkdownDocument` / `lesson-material-reader` / `lesson-files-section`（V19-E 入口范围；V19-B 合并工具行不动导出）；
- 不登记 files 表、不进索引/备份、不触发 contentChanged；不需要 activityGate 暂停；
- 零新依赖、零 migration；日志只记 fileId / 阶段 / 错误码（正文、文件清单、路径不进日志）；
- `?print=1` 加载同一 bundle——Renderer 分支渲染属 V19-E，本任务先允许通道无消费者（Main 侧超时兜底可测）。

## 验证

- 相关测试 + `npm run typecheck` + `npm run lint`；
- 既有 ipc-security 未锁通道清单同步更新（新通道入白名单）。

## 完成记录

2026-09-08 完成：

- `src/shared/export-contracts.ts`：常量（HEADER 100 / BODY 200_000 与 write-version 同限 / TIMEOUT 60_000）+ 四接口四守卫（ExportPrintRequest/Result/Payload + PrintReadyResult）；`isExportPrintResult` 只放行 `{saved: boolean}`（路径绝不进响应，V11-01）。
- `src/shared/ipc-contracts.ts`：`EXPORT_IPC_CHANNELS` 三条（print-to-pdf / get-print-payload / print-ready）+ IpcChannel 联合 + `EXPORT_BUSY/EXPORT_TIMEOUT/EXPORT_ERROR` 错误码。
- `src/shared/preload-api.ts` + `src/preload/index.ts`：`export` 命名空间三方法（runtime guards：isExportPrintResult/isExportPrintPayload/isPrintReadyResult），EXPORT_IPC_CHANNELS 经 preload-api 再导出。
- `src/main/export/export-service.ts`：`exportLessonPdf` 编排——buildPayload Main 二次校验（readText 包错→EXPORT_FILE_INVALID 稳定映射、挂课关系比对、files 只含本课 active 文件）；隐藏打印窗（createPrintWindow 端口 + webContentsId 记录）；print-ready 单次（printReadySeen）；printToPdf A4 版式（margins 0.63/0.55、displayHeaderFooter + header/footer 模板、headerText HTML 转义防注入）；60s 总超时 + onGone（render-process-gone/closed）→ rejectPending 销毁清理；保存 = chooseSavePath 端口（取消→saved:false）→ 同目录临时文件 + 原子重命名（失败 removePath 清理→EXPORT_ERROR）；打印引擎错误统一 EXPORT_ERROR；dispose() 供 before-quit。
- `src/main/ipc/export-ipc.ts`：三通道白名单注册/注销；get-print-payload / print-ready 带 `extractIpcSenderId` 比对（仅本次打印窗 webContents.id，防主窗冒充套取文件清单）；错误映射（IpcRequestError→INVALID_PAYLOAD、ServiceError 三码、其余 INTERNAL_ERROR）；日志只记通道 + 错误码。
- `src/main/index.ts`：registerExportIpc 接线（无 activityGate——只读流程零 DB 写）；getExportService 工厂 + createPrintWindowAdapter（windowWebPreferences + preload + applyWindowNavigationGuard + show:false + loadURL `?print=1`）；exportPorts（chooseSavePath 主窗 parent + PDF 过滤器、showItemInFolder、节点 fs 原子写盘端口）；before-quit：unregisterExportIpc + exportService.dispose()。
- 测试：`tests/export-contracts.test.ts` 5 例（常量钉死/请求边界 100±1/响应白名单拒路径/payload 上限与 files 形状/accepted 字面量）；`tests/export-service.test.ts` 9 例（注入 fake 窗口端口 + fake 保存端口：成功原子重命名+默认名+showInFolder+窗销毁/取消 saved:false/占用稳定错误+临时文件清理/超时销毁+fake timers/并发 BUSY/sender 校验+ready 单次/Main 校验非 md、未挂课、别课隔离/A4 模板+HTML 注入转义/命名规则）；`tests/export-ipc.test.ts` 6 例（三通道白名单注册注销/未知通道+载荷注入拒绝/全流程 dispatch/sender 冒充拒绝+无 sender 拒绝+ready 二次拒绝/BUSY+引擎错误映射+日志只码/senderId 提取器）。
- 门禁：全量 90 files / 512 tests（1 skip 既有）+ typecheck + lint 全绿（本节点无 build 要求；既有 ipc-security/security-baseline 白名单测试零改动通过——新通道经 EXPORT_IPC_CHANNELS 常量注册，未锁清单）。
