# V114-A · 新建讲义契约 + 服务 + 通道 + 测试

状态：IN_PROGRESS

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

（待填）
