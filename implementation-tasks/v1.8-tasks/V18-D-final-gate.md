# V18-D · 最终门禁与验收

**状态：** `DONE`（自动门；DeepSeek 真实自测与最终体验确认待产品负责人）

前置：V18-A/B/C 均 `DONE`。V1.8 唯一全量验收点。

## 范围

1. 全量 `npm test`、typecheck、lint、production build（electron-vite）、`git diff --check`；**不运行 portable/installer**；
2. 隔离 Windows 冒烟（沿用 V17-E 模式：独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA` + `--user-data-dir`，production 启动，走查后进程全终止 + 临时目录清理）：
   - 一对一：确认已上写反馈（徽标绿，学生页时间线出现且日期=排课日期）→ 跳过路径（徽标黄 → 面板补写 → 绿）→ 重复进入编辑态不重复建行；
   - 班课 3 学生（1 请假）：逐学生写/跳过、黄条提醒、请假默认跳过；
   - AI 整理链路用本地 fake/测试 provider（不要求真实 DeepSeek）；
3. DeepSeek 真实自测（产品负责人执行，预估 ≤ ¥1）：选一份真实转写 .txt → `feedback:generate` → 草稿质量与 Skill 遵循度走查 → 手改 → 保存 → 学生页验证；
4. 新建 `docs/v1.8-acceptance.md` 记录门禁、冒烟与真实自测证据；
5. 更新 STATUS/GOAL_PROGRESS；提交 `v1.8(V18-D): full gates, smoke and acceptance record`。

## 验收与标签

- 全部门禁绿 + `docs/v1.8-acceptance.md` 齐备 = 自动门完成；
- 产品负责人完成真实自测与最终体验确认后，才可在最终提交创建 `checkpoint-V1.8-pass`（与 `checkpoint-V1.7-pass`、`checkpoint-V1.7.2-pass`、`checkpoint-V1.7.3-pass` 互不替代、分别创建）。
