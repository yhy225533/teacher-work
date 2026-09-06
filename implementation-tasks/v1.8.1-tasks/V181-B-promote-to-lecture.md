# V181-B · 设为讲义底稿（服务 + IPC + 入口）

状态：DONE（2026-09-06）

## 目标

材料区选中的外部导入 md 可一键“设为讲义底稿”：生成 `原名 · 第 1 版.md` 副本进本课版本链（当前讲义），原件不动。

## 任务内容

1. `src/shared/file-contracts.ts`：`SetLessonFileRoleResult` 合同（file + version，同 WriteFileVersionResult 形状）；`src/shared/ipc-contracts.ts`：`FILE_IPC_CHANNELS` 追加 `setLessonRole: 'files:set-lesson-role'`（payload = FileIdRequest 同形复用，不新增请求接口）。
2. `src/main/files/managed-file-service.ts` 新增 `setLessonFileRole(fileId: string): { file: ManagedFileRecord; version: number }`：
   - 校验：目标必须是 text/markdown、` · 第 N 版.md`/`（编辑版）.md` 命中的文件直接返回 already-lecture 语义错误（INVALID_REQUEST 类）；
   - 解析挂接课次（同 writeVersion 的 lesson_files 查询）；
   - 读原件内容 → `createTextObjectAndRegister(body, stripMarkdownExtension(原名) · 第 nextLessonVersionNumber 版.md, {targetType:'lesson'})`；版本号取课次锚定 MAX+1（不是硬编码 1，避免与已有版本链冲突）；
   - 不写 manual_edit note（非编辑路径）。
3. `src/main/ipc/file-ipc.ts`：新通道 case（enqueueIndex + notifyContentChanged，同 writeVersion 处理）。
4. `src/preload/index.ts` + `src/shared/preload-api.ts`：`files.setLessonFileRole(request: FileIdRequest)`。
5. `src/renderer/lesson-material-reader.tsx` / `lesson-files-section.tsx`：材料区选中 md 且非讲义命名时显示“设为讲义底稿”按钮（可编辑课次 only）；成功后 reload + 选中新讲义并提示。
6. `tests/file-ipc.test.ts`：新通道往返 + 白名单包含；`tests/managed-file-service.test.ts`：行为用例（副本命名/版本号递增/原件不动/非 md 拒绝/已是讲义拒绝）。

## 边界

- 只作用于已挂本课的 managed 文件；外部根目录资料不可直接提（须先复制到本课）；
- 绝不 UPDATE 目标行；新副本走临时文件+原子重命名；
- 不改 writeVersion/发布/编辑保存逻辑。

## 验证

相关测试 + typecheck + lint。

## 完成记录

- 设计微调：版本号规则从"课次锚定 MAX+1"改为**同基名 MAX+1**（新底稿首版即第 1 版，同基名重复导入自动递增，跨基名独立）——与拍板示意图一致，验收记录已注明。
- 验证：managed-file-service 14 tests（含 setLessonFileRole 3 例）✅；file-ipc 6 tests（含新通道往返）✅；v1.8.1-courseware-groups pins ✅；typecheck ✅、lint ✅。
- 修改文件：`src/shared/ipc-contracts.ts`（+setLessonRole 通道）、`src/main/files/managed-file-service.ts`（setLessonFileRole + nextLectureBaseVersionNumber + isLectureCoursewareName）、`src/main/ipc/file-ipc.ts`（新 case + enqueueIndex/notifyContentChanged）、`src/preload/index.ts`、`src/shared/preload-api.ts`、`src/renderer/lesson-material-reader.tsx`（↥ 设为讲义底稿入口 + canPromoteSelectedFile）、`src/renderer/lesson-files-section.tsx`（promoteToLecture handler）、`tests/managed-file-service.test.ts`（+3 例）、`tests/file-ipc.test.ts`（+1 例）。
