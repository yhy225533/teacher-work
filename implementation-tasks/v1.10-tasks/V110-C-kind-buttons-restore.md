# V110-C · 生成类型三按钮并排（问题 4）

状态：TODO

## 目标

prepMode === 'new' 时生成类型恢复 V1.2 三按钮并排（讲义/例题/作业），可连续生成独立文件；drafts.generate 合同零改动。

## 前置产物

- `docs/v1.10-walkthrough-fixes-plan.md` §4；D63。

## 任务内容

1. `src/renderer/draft-panel.tsx`：撤除「生成类型」单选下拉与 improveKind state；new 模式渲染三个并排按钮（讲义 primary / 例题 / 作业 secondary，DRAFT_KINDS map），点击直发 generate(kind)；生成中全禁用、所点按钮「生成中…」；
2. single/lesson 模式（✦ 发送 → 方案确认流）零改动；plannedDraftKind 的 single/lesson 推导保留；
3. `src/renderer/styles.css`：按钮组样式（复用既有 primary/secondary，少量间距）；
4. tests：钉测（三按钮渲染与 kind 直发 / 下拉撤除断言 / 生成中禁用 / single/lesson 不受影响 / 合同零改动）。

## 门禁

相关测试 + typecheck + lint 全绿；V19-A 对话式布局其余钉测零回归。

## 完成记录

（待实施）
