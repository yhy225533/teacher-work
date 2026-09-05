# V173-E · 最终门禁与验收（V1.7.3 唯一全量点）

**状态：** `IN_PROGRESS`

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

## 完成记录（2026-09-05）

- 自动门：全量 79 files / 395 tests（394 passed + 1 skipped 既有）、typecheck、lint、production build（main 420 kB / preload 50 kB / renderer 1.54 MB）、`git diff --check` 全部通过。
- 隔离 Windows 冒烟：独立 app-data + --user-data-dir 启动 production Electron；4 进程存活、workspace.db 创建、窗口/输入正常、stderr 无错误；冒烟库 schema_migrations 1–17、notes CHECK 含 manual_edit；进程全终止、临时目录已删除。
- `docs/v1.7.3-acceptance.md` 建立（证据 + 走查清单）；未运行 portable/installer；不要求真实 AI 自测（本版本零 AI 生成改动）。
- 产品负责人按方案 §9 走查（验收文档第七节清单）确认后创建 `checkpoint-V1.7.3-pass`。
