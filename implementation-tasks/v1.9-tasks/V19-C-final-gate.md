# V19-C · 最终门禁与验收

状态：TODO

## 目标

V1.9 唯一全量验收点。自动质量门 + 隔离 Windows 真实导出冒烟 + 验收记录；产品负责人走查确认后创建 `checkpoint-V1.9-pass`。

## 前置产物

- V19-A / V19-B 完成（通道、服务、打印视图、入口、版式）；
- `docs/v1.9-pdf-export-plan.md` §10 已知限制与 §11 走查清单。

## 任务内容

1. 全量门禁：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`；不运行 portable/installer（符合约束）；
2. 隔离 Windows 冒烟（独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA` + `--user-data-dir` 启动 production Electron，默认安全配置）：
   - 导入样例 md（含行内 `$…$`、显示 `$$…$$` 与 `\[…\]` 跨行公式、表格、引用本课题图）挂课 → 课件区「导出 PDF」→ 保存到临时目录；
   - 产物断言：`%PDF-` 头、页数 > 0、体积合理、默认文件名 `.md`→`.pdf`；
   - 取消路径：对话框取消 → `saved:false`、无报错、无残留；
   - 并发路径：导出进行中再次触发 → `EXPORT_BUSY` 稳定提示；
   - 超时/失败清理：注入异常 → 打印窗销毁、无残留进程与临时文件；
   - 冒烟后 Electron 进程全部终止、临时目录删除（tasklist / TEMP 双复核）；
3. `docs/v1.9-pdf-export-acceptance.md`：实施表、自动门结果、冒烟记录、安全边界复核（sender 校验、原子落盘、路径不回传、日志无正文）、产品负责人走查清单（方案 §11 的 8 条，建议以高馨云第 12 讲真实讲义走查）；
4. `implementation-tasks/STATUS.md`、`implementation-tasks/GOAL_PROGRESS.md`、任务文件状态与完成记录同步。

## 门禁

- 全量测试、typecheck、lint、production build、diff check 全绿；
- 冒烟全部通过、无进程/临时文件残留；
- **不创建 `checkpoint-V1.9-pass`**——待产品负责人按走查清单确认后在最终提交创建（与既有 pass 标签互不替代）。

## 完成记录

（待实施）
