# V113-C · 最终门禁与验收

状态：DONE

## 目标

全量质量门 + 隔离 Windows 冒烟 + 验收文档；产品负责人走查确认后创建 `checkpoint-V1.13-pass`。

## 前置产物

- V113-A/B 完成；方案 §7。

## 任务内容

1. 全量测试、`npm run typecheck`、`npm run lint`、production build、`git diff --check`；
2. 隔离 Windows 冒烟（沿用 v1.12 冒烟框架）：
   - 隔离库预置：讲义（版本链 + 导入讲义 md + 外链 docx）、习题、试卷、misc、手动覆盖样本；
   - 断言：四组渲染与组序、启发式归组正确（含 K字壳 md + docx 同落讲义）、改组往返（设组 → 刷新持久 → 恢复自动）、课程页 chips 计数、D46 零回归（设为讲义底稿入口、当前版徽标、历史折叠）、stderr 无致命、进程与临时目录零残留；
3. `docs/v1.13-acceptance.md`：门禁证据 + 冒烟清单 + 走查清单；
4. STATUS.md / GOAL_PROGRESS.md 收口；里程碑提交。

## 门禁

全部自动门绿 + 冒烟全过 + 验收文档齐备。`checkpoint-V1.13-pass` 待产品负责人走查确认后创建。

## 完成记录

2026-09-13 完成：

- **自动门**：全量 100 files / 592 tests passed（1 skipped 既有）、typecheck、lint、production build、`git diff --check` 全绿。migration 钉测按标准演进 17→18（7 个测试文件）；mineru-migration v15 合成夹具补 lesson_files 表。首轮全量曾现 backup-restore 1 例失败（Windows 临时目录并发争用），单跑两次 + 全量复跑均过——既有偶发，与本版无关（如实记录于验收文档 §2）。
- **隔离 Windows 冒烟**：`tmp/v113-smoke/run-smoke.mjs`（V112-C 框架）**13/13**——四组渲染与启发式归组（版本链 md + 讲义 docx → 讲义；练习 → 习题；试卷 → 试卷复习；随记 → 其他）、hero chips 新语义（📘 讲义 2 / 📎 材料 3）、D46 零回归（当前徽标 + 版本链不出菜单）、手动改组往返（改组 → role='exam' 落库 → 恢复自动 → role=NULL）、菜单状态（当前组置灰/恢复自动可用）、docx 应用内预览零回归、stderr 健康。冒烟脚本自身缺陷两处（docx 夹具 zip 截断/offset 漏加 + 断言未对齐 displayFileName）诊断修复后复跑，产品代码无缺陷（记录于验收文档 §3）。
- **验收文档**：`docs/v1.13-acceptance.md`（自动门 + 冒烟清单 + 范围红线核对 + 走查清单 7 项 + 已知限制）。
- `checkpoint-V1.13-pass` 待产品负责人按走查清单确认后创建。
