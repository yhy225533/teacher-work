# V19-C · 课程页当前课次行动头

状态：TODO

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

（待实施）
