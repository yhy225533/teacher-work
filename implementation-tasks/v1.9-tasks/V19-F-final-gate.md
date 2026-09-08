# V19-F · 最终门禁与验收（全工作流）

状态：DONE

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

2026-09-08 完成（全链六节点收官）：

- **自动门全绿**：`npm test` 92 files / 521 tests passed（1 skipped 既有；含冒烟缺陷修复新增 chips 计数钉测）、typecheck、lint、production build、`git diff --check`；portable/installer 未运行（符合约束）。
- **隔离 Windows 冒烟 21/21 全绿**（production `out/main/index.js` + 独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA`/`--user-data-dir`/`--remote-debugging-port` + 本机 fake OpenAI-compatible + external_roots 预插 + CDP 仿真窄窗）：UI 走查（行动卡 crumb/chips/行动键/⋯ 三分组红区；直达课件区工具行/胶囊/三主键/⋯ 分组红区；备课工作台对话式 + single 自动挂载；**fake AI 对话流端到端**：要求→方案（同卡）→确认→流式→成果；MdEditor 编辑态；修改记录浮层开合；1000px 堆叠无破版；快速建课回归抽查）+ 导出走查（导出按钮 md 可用 + title；Main 二次校验两条稳定中文拒绝；`?print=1` 真实渲染 PrintDocumentView；sender 校验端到端拒冒充取载荷；stderr 健康检查）。
- **双复核通过**：无残留 electron 进程；`teacher-workbench-v19-smoke-*` 临时目录全部清理（含调试轮残留）。
- **冒烟发现并修复真实缺陷**：课程页文件计数 chips 停更——外部资料 importToLesson 不发 contentChanged，`course-detail.tsx` 补 core overview 结构变化（overviewRevision）兜底重拉；`tests/v1.9-course-hero-card.test.ts` 新增双线计数钉测。external-library-ipc 行为零变化（V1.7 冻结语义）。
- **自动化边界（如实记录）**：原生保存对话框为 Windows 模态，保存/取消/占用路径由 export-service/export-ipc 注入测试 20 例覆盖 + 人工走查；CDP Page.printToPDF 在本应用 Electron 调试协议未实现（-32601），编排参数已注入测试同参钉测，字节级保真归人工走查；错误码跨 contextBridge 不存活为既有行为（UI 只消费 message，冒烟实测确认）。
- **验收记录**：`docs/v1.9-acceptance.md`（实施表六节点、自动门、冒烟 21/21、安全边界复核、产品负责人双清单）。
- `checkpoint-V1.9-pass` 未创建——待产品负责人按双清单走查确认（与 V1.8.1 走查标签同批，互不阻塞）。
