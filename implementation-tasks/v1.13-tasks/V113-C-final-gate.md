# V113-C · 最终门禁与验收

状态：TODO

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

（待填）
