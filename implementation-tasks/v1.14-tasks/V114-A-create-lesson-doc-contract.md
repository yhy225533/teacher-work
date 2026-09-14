# V114-A · 新建讲义契约 + 服务 + 通道 + 测试

状态：DONE

## 目标

`files:create-lesson-doc` 通道打通：Render 传课次与名称，Main 创建版本链空白讲义并挂课。

## 前置产物

- `docs/v1.14-lesson-doc-create-and-tree-declutter-plan.md` §1；D82（`implementation-tasks/V1_14_DECISIONS.md`）。

## 任务内容

1. `src/shared/file-contracts.ts`：`CreateLessonDocRequest { lessonId, name }` + 守卫（name trim 后 1–80 字、无控制字符）；
2. `src/shared/ipc-contracts.ts`：`FILE_IPC_CHANNELS.createLessonDoc = 'files:create-lesson-doc'`；
3. `src/main/files/managed-file-service.ts`：`createLessonDoc(lessonId, name)`——requireActiveLesson → 名称清洗校验 → nextLectureBaseVersionNumber → createTextObjectAndRegister(`# ${base}\n`, `base · 第 N 版.md`, lesson link) → `{ file, version }`；
4. `src/main/ipc/file-ipc.ts`：case（守卫 + enqueueIndex + notifyContentChanged）；
5. `src/preload/index.ts` + `src/shared/preload-api.ts`：`files.createLessonDoc` + API 类型；
6. 测试：contracts 守卫、service（创建第 1 版/重名顺延第 2 版/空名与超长拒绝/未挂课文件无关路径零影响）、ipc（成功 + contentChanged + 伪造载荷）。

## 门禁

相关测试 + typecheck + lint 全绿。

## 完成记录

2026-09-14 完成。`CreateLessonDocRequest { lessonId, name }` + `isCreateLessonDocRequest`（结构守卫：仅两键、lessonId 非空、name trim 非空且 ≤80 字，`LESSON_DOC_NAME_MAX_CHARS` 共享常量）；`FILE_IPC_CHANNELS.createLessonDoc = 'files:create-lesson-doc'`；`ManagedFileService.createLessonDoc`——requireActiveLesson → 控制字符清洗（C0/DEL/C1 按码位过滤，no-control-regex 合规）+ trim + 1–80 字（违者 `FILE_SOURCE_INVALID`）→ `nextLectureBaseVersionNumber`（与设为讲义底稿同链同规则）→ `createTextObjectAndRegister("# ${base}\n", "base · 第 N 版.md", lesson link)`（临时文件 + 原子重命名 + 既有登记管线）→ `{ file, version }`；file-ipc case（守卫 + enqueueIndex + notifyContentChanged，V110-A/D61 先例）；preload `files.createLessonDoc`（响应守卫复用 `isWriteFileVersionResult`）+ preload-api 类型。测试：contracts（合法/空白/81 字/缺字段/多余键）、service（第 1 版首标题正文 + 挂课、同基名顺延第 2 版 + 异基名独立第 1 版 + 与 setLessonFileRole 共享版本号空间顺延第 3 版、空名/超长/课次不存在/已删除课次拒绝、控制字符清洗、无关文件零影响）、ipc（创建 + 索引 + contentChanged ×2、五种伪造载荷 INVALID_PAYLOAD + 坏课次 MANAGED_FILE_ERROR）。门禁：相关测试 33/33（含 ipc-security 通道白名单 3/3 回归）+ typecheck + lint 全绿。
