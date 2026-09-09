# V110-D · 最终门禁与验收（V1.10）

状态：DONE

## 目标

V1.10 唯一全量验收点。自动质量门 + 隔离 Windows 冒烟（状态保活往返 + 批量移除 + 连续生成）+ 验收记录。

## 前置产物

- V110-A/B/C 全部完成；`docs/v1.10-walkthrough-fixes-plan.md` §7 走查要点。

## 任务内容

1. 全量门禁：npm test、typecheck、lint、build、git diff --check；不运行 portable/installer；
2. 隔离 Windows 冒烟（production + 隔离数据目录 + fake AI + CDP）：备课勾选去勾若干 → ＋外部资料选文件回来 → 勾选状态原样（✕ 的不回来）+ 新文件自动入选择；树 hover ✕ 单删；管理态勾 2 份批量移除；历史版本行移除；new 模式连点讲义+作业两轮生成成功（各自独立 note）；
3. 冒烟后进程/临时目录双复核；
4. `docs/v1.10-acceptance.md`（实施表、自动门、冒烟记录、安全边界复核、产品负责人走查清单）；
5. STATUS.md、GOAL_PROGRESS.md、任务文件状态同步。

## 门禁

- 全量测试、typecheck、lint、production build、diff check 全绿；冒烟全部通过、无进程/临时文件残留；
- **不创建 `checkpoint-V1.10-pass`**——待产品负责人走查确认后创建（与既有 pass 标签互不替代）。

## 完成记录

- 2026-09-09 实施：
  - 全量门禁：`npm test` 94 files / 534 tests passed + 1 skipped（既有）；typecheck、lint、`npm run build` 三端产物、`git diff --check` 全绿；未运行 portable/installer（符合约束）。
  - 隔离 Windows 冒烟（`tmp/v110-smoke/run-smoke.mjs`，production + 隔离数据目录 + fake AI + CDP）：**17/17 全部通过**——场景 A 状态保活往返 6 项（含"备课工作台未卸载"直接证据与"去勾不回来 + 新文件自动入选择"）；场景 C 三按钮连发 2 项（讲义 + 作业两轮独立 note，fake AI 收到 2 请求）；场景 B 移除入口三层 4 项（树 ✕ 单删含当前讲义无 ✕ 白名单 / 管理态批量移除含确认清单 / 历史版本行 ✕）；健康检查 2 项。
  - 冒烟数据全部经既有白名单 IPC 造数（copyToLesson / setLessonFileRole / writeVersion），不直接改库（external_roots 单行预插沿用 V19-F 先例）。
  - 进程/临时目录双复核：Get-Process electron 空；`teacher-workbench-v110-smoke-*` 临时目录全部删除。
  - `docs/v1.10-acceptance.md`：实施表、自动门、冒烟 17/17、脚本设计说明、安全边界复核、产品负责人走查清单 18 条。
  - 不创建 `checkpoint-V1.10-pass`——待产品负责人走查确认后创建。

- 2026-09-09 最终验收确认：产品负责人走查反馈"基本验收通过"；走查期间报告的移除资料双 error 日志经维护增量 V1.10.1（V1101-A / D65，验收文档 §8）修复并复验（冒烟 18/18、移除场景 stderr 零 file_request_failed/mineru_request_failed）；据此创建确认提交 `v1.10(V110-D): record final acceptance` 并在其上创建 `checkpoint-V1.10-pass`（V1.10.1 按 V1.5.3.1 先例并入本验收，不单独建标签）。
