# V1.13 决策记录（课件区材料分组：role 列 + 启发式 + 手动改组）

- 日期：2026-09-13
- 背景：V1.8.1/D46 二分法（命名判据）无法承载思源试点导入后的真实材料形态（讲义/习题/试卷/杂项四类）；产品负责人拍板直接做持久化方案（跳过纯展示层方案），并裁决「补充讲义」类（讲义+习题一体）归讲义组。
- 设计基准：`docs/v1.13-lesson-material-groups-plan.md`

## D74 · `lesson_files.role` 列只存手动覆盖，NULL = 自动启发式，不回填

- migration v18 纯 `ADD COLUMN role TEXT CHECK (role IS NULL OR role IN ('lecture','exercise','exam','misc'))`，无表重建（v16 事故守卫框架照用，风险面未触发）；
- **不回填启发式结果、导入路径零改动**：启发式随版本可改进，NULL 行永远吃到最新规则；落库的只有老师的手动决定。备选否决：①导入时启发式打标——把当版规则钉死在历史数据上，规则改进无法生效，且要动 managed-file-service 三条导入路径；②migration 内 JS 回填——迁移只做 SQL 是本仓库纪律，且同样有钉死问题；
- `ManagedFileLink` 加可选 `role?`（仅 lesson 链接填写），overview 既有合同演进而非新增接口。

## D75 · 启发式为冻结顺序规则表，首中即停；「补充讲义」归讲义

- 规则顺序：索引壳（隐藏，不入组）→ D46 命名（lecture）→ 习题作业关键词（exercise）→ 试卷复习关键词（exam）→ 讲义类关键词 `讲义|精讲|补充|例题|教师版|学生版`（lecture）→ 课次标题互相包含（lecture）→ md 正文引用非图片本地文件（薄壳外链容器，lecture）→ misc 兜底；
- 2/3 先于 4/5：`AMC8 余数 - 作业.md`（stem 含课次标题且含"作业"）必须落 exercise；
- **产品负责人裁决**：补充讲义 = 讲义+习题连起来的一套系统 → `补充` 系列归 lecture（`数论补充材料`/`盐水浓度补充材料`/`应用题建模补充` 等）；`- 作业.md` 后缀的同名系列仍按作业优先；
- 内嵌图片不入组（维持嵌套机制）；规则不追求完美，识别错由 D76 手动改组兜底；
- 实现位置：Renderer 纯模块 `lesson-material-groups.ts`（正文快照只有渲染端有；Main 无需该逻辑）。

## D76 · 四组树 + 每文件 ⋯ 改组菜单；版本链文件不出菜单

- 组序与文案：📘 讲义 / ✏️ 习题与作业 / 📄 试卷与复习 / 📎 其他资料；讲义组内 D46 当前版徽标/历史折叠零变化；
- 改组菜单项：四组 + 恢复自动（仅手动覆盖过的文件可用）；当前组置灰；白名单 = 挂课文件 − `isLessonLectureFile` 命名文件（D46 讲义身份不可移出——否则"设为讲义底稿"入口可见性与版本链语义被破坏）；历史版本行/只读课次/管理态不出菜单；
- 课程页行动卡 chips 语义演进：讲义 N = lecture 组，材料 N = 其余三组之和（`splitLessonFilesByRole` 保留签名委托新函数，钉测演进记录语义变化）。

## D77 · 新通道 `files:set-material-group`，成功补发既有 contentChanged

- service `setLessonMaterialGroup`：requireActiveFile → 反查 lesson_files（无挂课拒绝 FILE_NOT_LINKED）→ UPDATE role → 返回 `{ file, group }`；与 `setLessonFileRole` 同反查模式；
- IPC 成功后 `notifyContentChanged`（复用既有事件，V110-A/D61 同先例——非内容变化但 overview 一致性需要；课程页行动卡计数、课件区四组、备课面板文件列表同帧刷新）；
- 备选否决：新广播事件——零收益加通道；不广播只本地 reload——课程页 hero 计数与备课面板会停旧值（V19-F chips 停更缺陷同款教训）。
