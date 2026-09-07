# V172-D · 最终门禁与验收

**状态：** `自动门 DONE / 走查待产品负责人`

前置：V172-A/B/C 均 `DONE`。V1.7.2 唯一全量验收点（对应 V17-E 角色）。

## 完成记录（2026-09-07）

- 全量门禁：83 files / 462 tests passed（1 skipped 既有）、typecheck、lint、production build、`git diff --check` 全绿；未运行 portable/installer（符合约束）。
- 隔离 Windows 冒烟（`tmp/v172-smoke/run-smoke.mjs`，本地不入库；production + 独立 app-data + 本机 fake AI SSE 服务 + DevTools 协议驱动）：**16/16 通过**——外部根目录预登记、外部 md 白名单复制进课次、真实 UI 导航（搜索↔课程 + 刷新 + 开始备课）、single 模式目标卡/参考行/预算行/空态分模式卡片、fake AI 流式生成 + publishToLesson 出第 1 版 md、重进后选中节点自动收起（摘要前缀/要求/题库状态）+ "调整要求"重展开、未装题库开关置灰 + title、生成器内无题库参数、视口 1000px 单列堆叠（主窗口 minWidth 960 无法物理缩窄 → DevTools 视口仿真验证断点）、fake provider 收到课次上下文、stderr 无致命、进程全终止 + 临时目录清理。
- `docs/v1.7.2-acceptance.md` 已建（走查清单见其 §五）。
- 产品负责人走查确认后才创建 `checkpoint-V1.7.2-pass`（与 `checkpoint-V1.7-pass` 分别创建、互不替代）。

## 范围

1. 全量 `npm test`、typecheck、lint、production build（electron-vite）、`git diff --check`；**不运行 portable/installer**；
2. 隔离 Windows 冒烟（沿用 V17-E 冒烟模式：独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA` + `--user-data-dir`，production 启动，走查后进程全终止 + 临时目录清理）：三模式走查——new 冷启动添加→生成；single 更换/参考 chips/要求→方案→确认→生成→新旧对比→发布；lesson + 题库开关→候选区头部参数（目标题数/学生版）→剔除/调整重选→确认生成；窗口 1100px 以下堆叠；AI 用本地 fake/测试 provider，不要求真实 DeepSeek（本增量未改 AI 逻辑）；
3. 新建 `docs/v1.7.2-acceptance.md` 记录门禁与走查证据；
4. 更新 STATUS/GOAL_PROGRESS；提交 `v1.7.2(V172-D): full gates, smoke and acceptance record`。

## 验收与标签

- 全部门禁绿 + `docs/v1.7.2-acceptance.md` 齐备 = 自动门完成；
- 产品负责人按方案 §11 走查清单确认体验后，才可在最终提交创建 `checkpoint-V1.7.2-pass`（可与 `checkpoint-V1.7-pass` 的确认合并进行，但两个标签分别创建）。
