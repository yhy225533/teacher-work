# V110-C · 生成类型三按钮并排（问题 4）

状态：DONE

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

- 2026-09-09 实施：
  - `src/renderer/draft-panel.tsx`：「生成类型」单选下拉与 improveKind state 撤除；new 模式发送区渲染 `prep-kind-buttons` 三按钮（`Object.values(DRAFT_KINDS).map`，讲义 primary / 例题·作业 secondary），点击直发 `generate(kind)`；生成中三按钮全禁用、所点按钮「生成中…」（busyAction === kind）；plannedDraftKind 撤 new 分支（仅服务 single 推导）；single/lesson 的「✦ 发送」按钮保留并只走 startImprovePlan()；new 模式舞台空态文案同步为三按钮指引。
  - `src/renderer/styles.css`：`.prep-kind-buttons` 三等分网格（复用既有 primary/secondary 按钮样式）。
  - tests：新增 `v1.10-kind-buttons` 4 例钉测；演进 3 处既有钉测——v1.5.3.1-scope-flow（V19-A 下拉钉 → D63 三按钮钉）、v1.7.2-workspace-structure（new 空态文案）、v1.9-prep-dialogue（发送路由与禁用钉）。
  - `drafts.generate` 合同零改动（kind 单值一次一请求；连续生成 = 连点，每次独立 requestId/note）。
- 门禁：相关测试 4 文件 40 例全过；全量 94 files / 534 tests passed + 1 skipped（既有）；typecheck、lint 全绿。
- Git：本地提交 `v1.10(V110-C): generation kind buttons restored`；随后 push（沿用 GitHub 授权）。
