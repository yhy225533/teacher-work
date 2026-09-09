# V111-D · 最终门禁与验收（全工作流）

状态：TODO

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

（待实施）
