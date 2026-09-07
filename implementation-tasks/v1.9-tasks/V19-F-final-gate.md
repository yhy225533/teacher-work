# V19-F · 最终门禁与验收（全工作流）

状态：TODO

## 目标

V1.9 唯一全量验收点（UI 重做 + PDF 导出全工作流）。自动质量门 + 隔离 Windows 冒烟（UI 三页走查 + 真实导出断言）+ 验收记录；产品负责人走查确认后创建 `checkpoint-V1.9-pass`。

## 前置产物

- V19-A/B/C/D/E 全部完成（备课工作台重做、课件区合并、课程页行动头、导出通道与服务、打印视图与入口）；
- `docs/v1.9-teaching-ui-restructure-plan.md` §8 UI 走查清单（8 条）；
- `docs/v1.9-pdf-export-plan.md` §10 已知限制与 §11 导出走查清单（8 条）。

## 任务内容

1. 全量门禁：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`；不运行 portable/installer（符合约束）；
2. 隔离 Windows 冒烟（独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA` + `--user-data-dir` 启动 production Electron，默认安全配置，fake provider）：
   - **UI 走查脚本**（`docs/v1.9-teaching-ui-restructure-plan.md` §8 八条）：备课工作台对话流（自动挂载 → 要求 → 方案 → 确认 → 同卡流式 → 成果编辑 → 发布）、修改记录浮层开合、课件区三主键 + ⋯ 菜单（含红区移除确认）、课程页行动卡 chips 与真实数据一致、1100px 窄窗堆叠不破版、V1.8.1 分组树与 V1.8 反馈链回归抽查；
   - **导出走查**（`docs/v1.9-pdf-export-plan.md` §11）：导入含公式+题图样例 md 挂课 → 工具行 `⬇ 导出 PDF` → 保存到临时目录 → 产物断言（`%PDF-` 头、页数 > 0、默认名 `.md`→`.pdf`）；取消路径（`saved:false` 无残留）；并发 `EXPORT_BUSY`；超时/失败清理（打印窗销毁、无残留进程与临时文件）；
   - 冒烟后 Electron 进程全部终止、临时目录删除（tasklist / TEMP 双复核）；
3. `docs/v1.9-acceptance.md`：实施表（UI 三节点 + 导出三节点）、自动门结果、UI 冒烟与导出冒烟记录、安全边界复核（sender 校验、原子落盘、路径不回传、日志无正文）、产品负责人走查清单（UI 方案 §8 八条 + 导出方案 §11 八条，建议以高馨云第 12 讲真实讲义走查）；
4. `implementation-tasks/STATUS.md`、`implementation-tasks/GOAL_PROGRESS.md`、任务文件状态与完成记录同步。

## 门禁

- 全量测试、typecheck、lint、production build、diff check 全绿；
- 冒烟全部通过、无进程/临时文件残留；
- **不创建 `checkpoint-V1.9-pass`**——待产品负责人按走查清单确认后在最终提交创建（与既有 pass 标签互不替代）。

## 完成记录

（待实施）
