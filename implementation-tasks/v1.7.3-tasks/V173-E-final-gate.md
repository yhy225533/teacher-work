# V173-E · 最终门禁与验收（V1.7.3 唯一全量点）

**状态：** `TODO`

方案基准：`docs/v1.7.3-md-editor-formula-ux-plan.md` §7、§9、§10、§11。

## 范围

- 全量测试、typecheck、lint、production build、`git diff --check`；
- 隔离 Windows 冒烟（开发窗口，不运行 portable/installer）：§9 走查清单 1–8 逐项（缩写/自动分式/Tab/斜杠/快捷键/三视图记忆/同步滚动/长文档流畅度/坏公式/撤销/保存为新版本语义）；
- 新建 `docs/v1.7.3-acceptance.md`（门禁证据 + 走查记录 + 限制与遗留）；
- 更新 `implementation-tasks/STATUS.md`、`GOAL_PROGRESS.md`。

## 不做

- portable/installer/对外交付包；真实 DeepSeek 自测（本版本不涉及 AI 生成改动，无需真实 Key 自测；如走查发现生成链交叉影响再议）。

## 验收

- 产品负责人按 §9 清单完成真实窗口走查确认后，创建 `checkpoint-V1.7.3-pass`（与 `checkpoint-V1.7-pass`、`checkpoint-V1.7.2-pass` 互不替代、分别创建）；
- 里程碑提交 `v1.7.3(V173-E): final gate and acceptance`。
