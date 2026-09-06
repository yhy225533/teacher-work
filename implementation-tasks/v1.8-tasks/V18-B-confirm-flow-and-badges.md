# V18-B · 确认已上弹窗内嵌反馈（一对一）+ 反馈可见性

**状态：** `DONE`

方案基准：`docs/v1.8-lesson-feedback-plan.md` §2（D39/D40/D42）、§5.1、§5.2、§5.3、§5.6、§6。前置：V18-A `DONE`。

## 范围

- `src/renderer/course-view-model.ts`：`lessonFeedbackStatus`（§5.1：taught / complete / 每生 hasFeedback，基于 overview.notes + activeStudents）；
- `src/renderer/confirm-lesson-taught-modal.tsx` 重做（§5.3 结构与 6 条状态规则）：
  - 反馈区（meta 行：学生 chip + 自动反馈日期；textarea + 字数计数）；
  - 主按钮 gating（一对一非空才可用）、跳过次按钮 → skip-reason 展开（2 项原因单选 + 红色二次确认 + 返回）；
  - upsert 编辑态：已有反馈预填最新一条，主按钮「更新反馈并确认已上」、次按钮「保持原反馈，只确认已上」；
  - 保存编排：`createNote`（occurredOn=scheduledOn ?? 当天本地日期）/ `updateNote` → `confirmLessonTaught`，失败 inline-error 停留弹窗可重试；
  - 无在读学生：反馈区 empty 文案 + 主按钮退化为纯确认；
  - props 需要当前课程 summary 的 activeStudents 与 overview（沿用既有传递路径，必要时经 course-dashboard 透传）；
- `src/renderer/course-detail.tsx`：课次行徽标（`taught && complete` → 绿「已反馈」；`taught && !complete` → 黄「缺反馈」，新 CSS 类 `is-missing`）；Viewed Lesson 面板反馈区（黄条 + 补写按钮 / 摘要行，§5.2）；
- `src/renderer/lesson-feedback-modal.tsx` 新建：补写弹窗（反馈区组件复用：提取共享组件 `LessonFeedbackSection` 供确认弹窗与补写弹窗同用；无 Current Lesson 下拉、无确认按钮、主按钮「✓ 保存反馈」）；`course-detail.tsx` 接线（面板黄条按钮打开）；
- `src/renderer/styles.css`：徽标黄态、feedback-alert 黄条、反馈区/折叠块样式（值取自 `tmp/mockups/lesson-feedback-flow.html`，tokens 与既有变量一致）；
- 本任务反馈区工具行只渲染「反馈 Skill」select（数据源 `skills.list`，含"不使用 Skill（默认结构）"）占位；「🎙 录音/转写转反馈」按钮渲染置灰占位（V18-C 接线）；
- 测试：`v1.8-feedback-ui.test.ts` 首批（主按钮 gating、跳过二次确认、upsert 分支、occurredOn 自动值、徽标派生、补写弹窗无 Current Lesson、无学生退化）；既有钉测演进（`grep -rn "确认本课已上\|ConfirmLessonTaught" tests/` 先定位）。

## 不做

- 班课折叠列表与到课徽标、missing-inline 黄条（V18-C）；录音/转写区接线（V18-C）；skills 逻辑与后端（已就绪）。

## 验收

- 一对一开发窗口全流走查（写反馈确认 → 徽标绿；跳过 → 徽标黄 → 面板补写 → 绿；重复进入不重复建行）；
- 相关测试 + 全量 `npm test`、typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.8(V18-B): confirm-taught embedded feedback and visibility`。
