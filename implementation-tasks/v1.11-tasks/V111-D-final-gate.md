# V111-D · 最终门禁与验收（全工作流）

状态：DONE

## 目标

V1.11 唯一全量验收点。自动质量门 + 隔离 Windows 冒烟（真实 PDF/docx 渲染断言）+ 验收记录；产品负责人走查确认后创建 `checkpoint-V1.11-pass`。

## 前置产物

- V111-A/B/C 全部完成；`docs/v1.11-office-pdf-preview-plan.md` §7/§8（验收要点与已知限制）。

## 任务内容

1. 全量门禁：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`；不运行 portable/installer；
2. 隔离 Windows 冒烟（独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA` + `--user-data-dir` + `--remote-debugging-port`，production Electron）：
   - fixture：小体积真实 PDF（含可断言文本）与 .docx（含可断言段落文本）经白名单通道挂到冒烟课次；
   - PDF 断言：阅读器选中后 `canvas` 元素渲染（pdfjs 默认 canvas 模式）且像素非空白；失败态逃生门存在（onOpenFile 按钮渲染）；
   - docx 断言：`.docx-wrapper` DOM 存在且包含 fixture 文本；
   - 回归断言：md 渲染（MarkdownDocument）、图片（dataUrl img）、.doc（虚构扩展名 → unsupported + 系统打开按钮）三分支零回归；
   - stderr 健康检查；冒烟后进程/临时目录双复核；
3. `docs/v1.11-acceptance.md`：实施表（四节点）、自动门结果、冒烟记录、安全边界复核（内容走 IPC/无脚本执行/链接守卫/12MB 上限/依赖白名单）、产品负责人走查清单（真实工作库中的 PDF 卷子 + docx 讲义各点开预览 + 逃生门 + 既有 md/图片/编辑/移除零回归）；
4. `implementation-tasks/STATUS.md`、`implementation-tasks/GOAL_PROGRESS.md`、任务文件状态同步。

## 门禁

全量测试、typecheck、lint、production build、diff check 全绿；冒烟全部通过、无进程/临时文件残留；**不创建 `checkpoint-V1.11-pass`**——待产品负责人按走查清单确认后创建。

## 完成记录

2026-09-09 完成。

- **自动门**：全量 96 files / 553 tests passed（1 skipped 既有）、typecheck、lint、production build（`pdf.worker.min-*.mjs` 资产产出）、`git diff --check` 全绿；未运行 portable/installer。
- **冒烟**：隔离 Windows 冒烟（production `out/main/index.js` + 独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA` + `--user-data-dir` + `--remote-debugging-port` + external_roots 单行预插 + CDP 驱动；无 AI 调用故无 fake provider）**10/10**：真实 PDF fixture canvas 渲染 + 像素非空白（815×1054，nonWhite=3884，alpha 感知）、PDF/docx 逃生门、docx `.docx-wrapper` 含 fixture 文本、md/png/.doc 三分支零回归、stderr 健康；连跑 4 轮均 10/10。
- **冒烟暴露并修复两处渲染缺陷**（详见 `docs/v1.11-acceptance.md` §4）：
  1. pdfjs worker 版本失配——顶层 pdfjs-dist v6.2.108（officeparser override 固化）≠ react-pdf 内嵌 API v5.4.296；workerSrc 深路径改指 `react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`；
  2. react-pdf `file` 载荷字面量引用竞态——每次重渲染取消重载致加载永不收敛（resize 亦触发，真实产品缺陷）；改 `useMemo` 按 dataUrl 记忆化。
  两处修复均补进钉测（worker 深路径/useMemo/file={file}/禁字面量/setLoadError）并全量回归。
- **复核**：冒烟后 Electron 进程零残留、`teacher-workbench-v111-smoke-*` 临时目录零残留。
- **验收记录**：`docs/v1.11-acceptance.md`（实施表/自动门/冒烟记录/安全边界复核/走查清单/已知限制）。
- **状态同步**：STATUS.md、GOAL_PROGRESS.md、本文件 DONE。
- `checkpoint-V1.11-pass` 未创建——待产品负责人按验收文档 §6 走查清单确认。
