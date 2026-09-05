# V18-C · 班课反馈列表 + 录音/转写转反馈

**状态：** `TODO`

方案基准：`docs/v1.8-lesson-feedback-plan.md` §2（D41/D43/D44）、§5.4、§5.5、§6。前置：V18-B `DONE`。

## 范围

- 班课反馈区（§5.4）：`LessonFeedbackSection` 扩展为在读学生折叠列表（一对一保持单学生形态）；行头 到课/请假/缺席 徽标（`attendance.getLesson`，未点名不显示）；到课学生 待写/已写✓ 状态；请假/缺席默认折叠虚线"可跳过"；头部徽章 `N / M 已写`（分母=到课学生）；
- 班课 gating：主按钮可用 = ≥1 名到课学生有内容；首次点击存在到课未写 → `.missing-inline` 黄条列名（不阻断）；再次点击 → 已写的保存、未写的跳过，继续 confirm；请假/缺席学生填写了也保存；
- 录音/转写转反馈（§5.5）：
  - `.rec-flow` 折叠块：路径 A 主入口（[选择文件…] → `feedback:read-transcript` → 文件 chip（名/字数/truncated 提示）→ 自动 `feedback:generate` → 两段进度（读取转写并整理 → 草稿就绪）→ draftText 填入当前学生 textarea）；路径 B 置灰（"未配置语音模型 · 后续版本"）；
  - [取消/重新选择材料]：中断（AbortController）+ 清该生草稿态，不动已手写内容；
  - 反馈 Skill select 接线：选项影响下一次 generate（已生成草稿不回改）；所选 skillId 记入保存时 aiMetadata（`FeedbackNoteMetadata`，含 provider/model/transcriptChars）；
  - 草稿来源标签："AI 草稿 · 请人工修改" → 内容与 draftText 不一致时切"已人工修改 ✓"（绿）；保存成功消失；
  - 生成中该生 textarea 禁用（避免竞争），其余学生不受影响；班课逐学生独立发起；
- 补写弹窗同步获得全部上述能力（共享组件零成本）；
- 测试：`v1.8-feedback-ui.test.ts` 追加（班课折叠/gating/黄条/请假跳过、rec-flow 展开收起、路径 B 置灰、Skill select 选项、来源标签切换、生成中禁用）；如需 Main 侧行为钉测在 V18-A 测试文件补例。

## 不做

- 语音模型配置、任何音频上传逻辑（D45 非目标）；.docx/.pdf 转写（D45）。

## 验收

- 班课（≥2 学生含 1 请假）开发窗口走查：逐学生写/跳过/请假；AI 整理用本地 fake provider（测试注入或 mock 层）；
- 相关测试 + 全量 `npm test`、typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.8(V18-C): class feedback list and transcript to feedback`。
