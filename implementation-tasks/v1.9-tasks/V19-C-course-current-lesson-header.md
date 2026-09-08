# V19-C · 课程页当前课次行动头

状态：DONE

## 目标

课程页右上方从"静态课程名片"换成"当前课次行动卡"：crumb（课程·模式·阶段·共 N 课）+ 大字当前课次 + chips（排课时间/学员/讲义 N/材料 N/上节反馈✓）+ 行动键（进入教学内容 primary / 点名 / 确认本课已上 / ⋯）；撤 course-page-header 统计条（收进行动卡 ⋯"全局"组）。打开首屏 0 步回答"现在做哪一课、有哪些内容"，行动键上移约 200px。

## 前置产物

- `docs/v1.9-teaching-ui-restructure-plan.md` §5
- `implementation-tasks/V1_9_DECISIONS.md` D58
- 既有：`lessonFeedbackStatus`（V1.8 course-view-model）、`splitLessonFilesByRole`（V1.8.1，讲义/材料计数）、`formatLocalDateTime`、session.scheduledAt、V19-B 的 `app-menu.tsx` 共用菜单

## 任务内容

1. `src/renderer/course-dashboard.tsx`：撤 `course-page-header`（"全部课程 N/修改记录 N/刷新/仅创建课程/+ 快速建课" → 行动卡 ⋯"全局"组）；未选课程空态保留最小页头（刷新 + 建课）；
2. `src/renderer/course-detail.tsx`：`course-detail-header` 改为当前课次行动卡——
   - crumb：课程名 · 一对一/班课 · 阶段 · 共 N 课（第 M 课）；
   - 大字：当前课次标题 + Current/已结束徽标；
   - chips：🕘 排课时间（scheduledAt 本地格式，未排显示"未排时间"）｜👤 学生名（一对一）/在读 N 人（班课）｜📘 讲义 N ｜📎 材料 N（splitLessonFilesByRole 计数）｜上节反馈 ✓（lessonFeedbackStatus）；
   - 行动键：`▶ 进入教学内容`（primary，定位当前课次）｜`点名`｜`确认本课已上`；`⋯`（本课：调整当前课次/设置时间；本课程：学生名单[切学生 tab]/修改记录/结束课程[红区]；全局：+ 快速建课/+ 仅创建课程/刷新）；
3. Viewed 规则：选中非当前课次 → 行动卡主角换为该课次（chips/行动键指向它，"进入教学内容"定位该课次，确认已上/点名作用于该课次）；已结束 → 仅"查看教学内容"+ ⋯（重新开启）；Viewed Lesson 卡保留（长列表操作入口），与行动卡共用 handler；
4. 测试：行动卡渲染钉测（crumb/大字/chips 五项数据派生/行动键三 + ⋯ 分组/红区底部）；非当前课次主角切换；已结束/未排时间退化；未选课程最小页头；今日点名条、课次表、CourseList、V1.8 反馈徽标零回归。

## 边界

- 零 IPC / 零 migration / 零新依赖；chips 全部现有 overview 派生（lesson_files 计数/反馈状态/排课时间），无新增通道；
- 今日待点名条、课程列表、课次表、点名/确认已上弹窗（V1.8）、快速建课入口（收进 ⋯，行为不变）、课程生命周期动作全部零语义改动；
- App 默认导航仍为"课程"页（"打开直落教学内容"为后续目标态，本版不动）。

## 验证

- 相关测试 + `npm run typecheck` + `npm run lint` + `npm run build`。

## 完成记录

2026-09-08 完成：

- `course-dashboard.tsx`：`course-page-header` 统计条退役（全部课程统计/修改记录/刷新/仅创建课程/+ 快速建课 → 行动卡 ⋯"全局"组）；`selectedSummary === null` 时渲染最小页头 `course-minimal-head`（刷新 + 仅创建课程 + 快速建课）；`CourseDetail` 传入 `courseCount/draftCount/onOpenDraftInbox/onQuickCourse/onCreateCourse/onReload`。
- `course-detail.tsx`：`course-detail-header` 静态名片 → 当前课次行动卡 `lesson-hero-card`——crumb（课程 · 一对一/班课 · 阶段 · 共 N 课（第 M 课））+ 大字（主角课次 + Current/已上/已结束徽标）+ chips 五项（🕘 排课时间 formatSessionSchedule / 👤 一对一学生名·班课在读 N 人 / 📘 讲义 N / 📎 材料 N [files:get-overview + listLessonPrepFiles + splitLessonFilesByRole，files.onContentChanged 跟随刷新] / 上节反馈 ✓·✍ 待补写 [previousTaughtLesson + lessonFeedbackStatus]）+ 行动键（▶ 进入教学内容 primary / 点名·修改点名 / 确认本课已上 / ⋯）。
- 主角规则：`hero = viewedLesson ?? summary.currentLesson`——选中非当前课次时 chips/行动键指向该课次；已结束课程 primary 变"查看教学内容"、菜单红区变"重新开启课程"；hero 为空（无课次）显示建阶段主键。`courseMoreMenu`/`course-detail-mode`/`courseStudentsLine`/`currentLessonLine` 退役；`lesson-more-menu`（Viewed 卡撤销已上）与 1100px 断点保留演进。
- ⋯ 菜单（AppMenuButton）：本课（调整当前课次/设置时间）→ 本课程（学生名单切学生 tab/修改记录 N）→ 全局（全部课程 N 统计置灰/快速建课/仅创建课程/刷新）→ 红区（结束课程/重新开启课程 danger 底部）；endCourse/reopenCourse 自退役名片原样搬迁（v1.2 语义零变化）。
- `styles.css`：`.lesson-hero-card/.lesson-hero-crumb/.lesson-hero-title/.lesson-hero-chips/.hero-chip(.is-missing/.is-feedback-done)/.lesson-hero-actions/.course-minimal-head/.course-empty-actions`；退役 `.course-page-header/.course-page-stats/.course-page-actions/.course-detail-header/.course-detail-actions/.course-detail-mode/.course-more-menu`；1100px 断点改 `.lesson-hero-card` 堆叠。
- 测试：新建 `tests/v1.9-course-hero-card.test.ts`（7 例：统计条退役+最小页头/行动卡结构/菜单分组红区/chips 派生零新 IPC/主角规则/冻结流程零回归/样式）；演进 `tests/v1.2-course-ui.test.ts` 2 处（修改记录入口移 CourseDetail、course-more-menu → AppMenuButton）。既有 LessonsSection/Viewed 卡/点名/反馈/快速建课钉测零改动自然通过。
- 门禁：全量 86 files / 492 tests（1 skip 既有）+ typecheck + lint + production build 全绿。
