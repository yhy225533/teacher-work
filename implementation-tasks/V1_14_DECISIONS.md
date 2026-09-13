# V1.14 决策记录（课件区新建讲义 + 树降噪）

- 日期：2026-09-14
- 背景：产品负责人实测课件区无任何"从零创建"入口（⋯ 菜单全是加工已有文件的动作），且四组展示下空组长文案/重复树头/全员"外部资料"徽标造成结构性噪音。
- 设计基准：`docs/v1.14-lesson-doc-create-and-tree-declutter-plan.md`

## D82 · 新建讲义 = 版本链产物，重名自动顺延

- `files:create-lesson-doc {lessonId, name}` → `createLessonDoc`：requireActiveLesson → 名称 trim + 去控制字符 + ≤80 字（违者 `FILE_SOURCE_INVALID`）→ `nextLectureBaseVersionNumber`（重名自动 `第 N+1 版`，与"设为讲义底稿"同规则）→ `createTextObjectAndRegister("# ${base}\n", "base · 第 N 版.md", lesson link)` → 返回 `{ file, version }`（复用 `isWriteFileVersionResult` 守卫）；
- 备选否决：普通裸 md——与"新建一份讲义"语义不符（还要手动设为讲义底稿才能进 AI 链，多一步）；notes 承载——讲义是文件不是记录。
- 产品负责人拍板：版本链形态。手写讲义与 AI 生成讲义同级（当前徽标/✎编辑/✦修改这份全通）。

## D83 · 双入口 + 创建后直进编辑态

- 入口：①⋯ 菜单"本课"组第一位「＋ 新建讲义」；②讲义组头右侧轻量「＋」（LessonMaterialTree 新可选 prop）。readOnly 均不渲染；
- 名称用既有 `requestText` 应用内输入框（默认名 = 课次标题）；创建成功 → 选中新文件 + 进入编辑态（V19-B 受控 editing）+ notice 提示；contentChanged 补发刷新四组与行动卡计数（V110-A/D61 先例）。

## D84 · 树降噪四件套

1. 空组一行化："📘 本课讲义 · 暂无"，删除各组空态文案（META emptyText 退役）；引导合并进整课 0 文件空态一句；
2. 树头去重：不再渲染课次标题（与工具行重复），只留 "N 项 [管理]"；
3. "外部资料"徽标默认隐藏：来源徽标仅显示"素材库"（新助手 `lessonFileBadgeLabel`：外部资料 → null；`lessonFileSourceLabel` 保留给需要完整来源的场景）；
4. 启发式补词：exercise 词表追加 `特训|精练|全解全析|分层|\d{1,3}题`——"二次根式80题全题型"类落习题与作业；误判由 V1.13 手动改组兜底。

## D85 · 门禁与验收

- V114-C 全量门禁（全量测试/typecheck/lint/build/diff check/隔离冒烟）；冒烟扩展：新建讲义 → 自动进编辑器 → 保存为第 2 版（版本链复验）+ 降噪树断言（空组一行、无重复标题、无外部资料徽标、80题文件落习题与作业）；
- `checkpoint-V1.14-pass` 待产品负责人走查确认后创建。
