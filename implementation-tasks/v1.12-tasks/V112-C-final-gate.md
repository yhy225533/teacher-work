# V112-C · 最终门禁与验收（全工作流）

状态：TODO

## 目标

V1.12 唯一全量验收点。自动质量门 + 隔离 Windows 冒烟（带图 docx 图片渲染 + 外部资料预览断言）+ 验收记录；产品负责人走查确认后创建 `checkpoint-V1.12-pass`。

## 前置产物

- V112-A/B 完成；`docs/v1.12-external-preview-plan.md` §5/§6/§7。

## 任务内容

1. 全量门禁：`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`、`git diff --check`；不运行 portable/installer；
2. 隔离 Windows 冒烟（独立 `TEACHER_WORKBENCH_L01_SMOKE_APP_DATA` + `--user-data-dir` + `--remote-debugging-port`，production Electron，external_roots 预插 + fixture 外部资料目录）：
   - **带图 docx 预览**：手写带图 docx fixture（zip 含 media png）挂课次 → 课次阅读器选中 → `.docx-wrapper` 渲染 + **内嵌图片元素渲染且图片 src 为 data: URL**（非 blob:）+ 图片非空白像素/尺寸断言；
   - **外部资料预览**：外部根目录放 pdf/docx/md/png/txt/.doc fixture → 外部资料页选中 → 预览区断言（pdf canvas / docx wrapper / md MarkdownDocument / img / .doc 不可预览元数据卡 + 打开文件按钮）；
   - **零回归**：课次阅读器 V1.11 场景（纯文字 docx + pdf + md + png + .doc unsupported）全量复跑；
   - stderr 健康检查；冒烟后进程/临时目录双复核；
3. `docs/v1.12-acceptance.md`：实施表（三节点）、自动门结果、冒烟记录、安全边界复核（新通道载荷校验/路径不逃逸/纯只读/CSP 零改动/12MB/依赖白名单）、产品负责人走查清单；
4. `implementation-tasks/STATUS.md`、`implementation-tasks/GOAL_PROGRESS.md`、任务文件状态同步；AGENTS.md 头部与活动增量段更新到 V1.12。

## 门禁

全量测试、typecheck、lint、production build、diff check 全绿；冒烟全部通过、无进程/临时文件残留；**不创建 `checkpoint-V1.12-pass`**——待产品负责人按走查清单确认后创建。

## 完成记录

（待实施）
