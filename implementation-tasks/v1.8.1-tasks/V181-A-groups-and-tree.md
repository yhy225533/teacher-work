# V181-A · 课件区分组数据与树渲染

状态：DONE（2026-09-06）

## 目标

课件区左侧目录树把本课文件分为【本课讲义】【本课材料】两组渲染（方案 A），讲义组在前、材料组在后；讲义组文件带“当前”徽标；材料组文件带来源标签（外部/素材库）；讲义组为空时显示引导文案。

## 前置产物

- `docs/v1.8.1-courseware-lecture-material-split-plan.md`（设计基准）
- `implementation-tasks/V1_8_DECISIONS.md` D46/D47
- 既有：`lesson-prep-context.ts` 的 `lessonVersionPattern` / `classifyLessonCoursewareFiles` / `lessonFileSourceLabel`、`lesson-material-reader.tsx` 的 `LessonMaterialTree`、`styles.css` 的 `material-reader-tree-group*` 样式

## 任务内容

1. `src/renderer/lesson-prep-context.ts` 新增纯函数 `splitLessonFilesByRole(files: readonly ManagedFileRecord[]): { lecture: ManagedFileRecord[]; materials: ManagedFileRecord[] }`：
   - `lecture` = 命中 ` · 第 N 版.md`（任一版本，最新版由既有 classify 派生，不在此重复）或 `（编辑版）.md` 的文件，保持原相对顺序；
   - `materials` = 其余文件；
   - 不做删除/过滤（结构索引过滤仍由调用方 `filterLessonMaterialFiles` 先行完成）。
2. `src/renderer/lesson-material-reader.tsx` 的 `LessonMaterialTree` 改为分组渲染：
   - 讲义组标题【本课讲义】+ 数量；材料组标题【本课材料】+ 数量；
   - 讲义组内文件复用现有行渲染（含题图子节点逻辑，讲义正文引用的题图仍挂在讲义下）；
   - 材料组行尾渲染 `lessonFileSourceLabel(file)` 标签（复用既有样式类）；
   - 讲义组为空时显示引导文案“还没有讲义——可从下方材料设为讲义底稿，或用 AI 生成第一版”；
   - `showHeading=false` / 无分组数据的调用方（draft-panel 的 ScopeFileList 若复用该组件）行为不变——通过仅在课件区上下文启用分组的可选 prop 控制（`grouped = false` 默认，保持既有调用零改动）。
3. `src/renderer/lesson-files-section.tsx`：向 `LessonMaterialReader` 传 `grouped`（课件区 true）；
4. `src/renderer/styles.css`：分组标题徽标、来源标签、引导文案样式（复用既有 tree-group 样式，少量补充）。

## 边界

- 不改 `classifyLessonCoursewareFiles`/`filterLessonMaterialFiles`/`buildLessonMaterialTree` 的既有签名与行为（既有钉测全绿为前提）；
- 不改 draft-panel / ScopeFileList / AI 修改；
- 右侧正文阅读、题图跟随、MinerU、编辑入口不动。

## 验证

- `tests/lesson-prep-context.test.ts` 追加 splitLessonFilesByRole 分组规则用例（版本链/编辑版→讲义；外部 md/docx/图片→材料；顺序保持）；
- 新增 `tests/v1.8.1-courseware-groups.test.ts`：分组渲染、徽标、引导文案、grouped=false 不分组的钉测；
- 演进受影响钉测（如 v1.5-teaching-content-ui、v17-b/c 中对 lesson-files-section/reader 的结构钉测）；
- 相关测试 + `npm run typecheck` + `npm run lint`。

## 完成记录

- 验证：lesson-prep-context 11 tests（含 splitLessonFilesByRole 3 例新用例）✅；v1.8.1-courseware-groups 5 例 ✅；v1.5-teaching-content-ui / v17-b / v17-c 既有钉测全绿；typecheck ✅、lint ✅。
- 修改文件：`src/renderer/lesson-prep-context.ts`（splitLessonFilesByRole + isLessonLectureFile）、`src/renderer/lesson-material-reader.tsx`（LessonMaterialTree 分组渲染 grouped/currentLectureId 可选 props + 徽标/空态）、`src/renderer/lesson-files-section.tsx`（课件区启用 grouped + currentLectureId 传版本链最新版）、`src/renderer/styles.css`（role-group 标题/徽标/空态样式）、`tests/lesson-prep-context.test.ts`（+3 例）、`tests/v1.8.1-courseware-groups.test.ts`（新）。
