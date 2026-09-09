# V110-D · 最终门禁与验收（V1.10）

状态：TODO

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

（待实施）
