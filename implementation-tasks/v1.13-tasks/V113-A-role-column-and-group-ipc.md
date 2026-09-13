# V113-A · contracts + migration v18 + 设组服务/通道 + 测试

状态：IN_PROGRESS

## 目标

`lesson_files` 获得 `role` 列（手动覆盖组，NULL = 自动）；老师可通过新通道手动改组并持久化；overview 链接携带 role。本节点不做任何 UI 与启发式。

## 前置产物

- `docs/v1.13-lesson-material-groups-plan.md` §2/§5；D74/D77（`implementation-tasks/V1_13_DECISIONS.md`）。

## 任务内容

1. `src/shared/file-contracts.ts`：`LessonMaterialGroup` 类型 + `LESSON_MATERIAL_GROUPS` 常量 + `SetLessonMaterialGroupRequest` / `SetLessonMaterialGroupResult` + 守卫（group 可 null；group 非 null 时必须四值之一）；`ManagedFileLink` 加可选 `role?: LessonMaterialGroup | null`，`isManagedFileLink` 演进放行；
2. `src/shared/ipc-contracts.ts`：`FILE_IPC_CHANNELS.setMaterialGroup = 'files:set-material-group'`；
3. `src/main/db/migrations.ts`：migration v18 `add_lesson_files_role`——纯 `ALTER TABLE lesson_files ADD COLUMN role TEXT CHECK (role IS NULL OR role IN ('lecture','exercise','exam','misc'))`，无表重建；
4. `src/main/files/managed-file-service.ts`：`listLinks` 查询带出 `lf.role`（仅 lesson 分支）+ `mapLink` 映射；新方法 `setLessonMaterialGroup(fileId, group | null)`——requireActiveFile → 反查 lesson_files（空 → `FILE_NOT_LINKED`）→ UPDATE role → 返回 `{ file, group }`；
5. `src/main/ipc/file-ipc.ts`：`setMaterialGroup` case（`isSetLessonMaterialGroupRequest` 校验 + 成功后 `notifyContentChanged`）；
6. `src/preload/index.ts`：`files.setMaterialGroup`；
7. 测试：contracts 守卫（request/result/link.role 演进）、migration v18（新列 CHECK 生效 + 旧行 NULL + 迁移序列 18）、service（设组/清除/未挂课拒绝/软删文件拒绝/overview link 带 role）、ipc（白名单 + 成功补发 contentChanged + 伪造载荷拒绝）。

## 门禁

相关测试 + `npm run typecheck` + `npm run lint` 全绿。

## 完成记录

（待填）
