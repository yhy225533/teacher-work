# V112-C · 最终门禁与验收（全工作流）

状态：DONE

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

2026-09-10 完成。

- **自动门**：全量 98 files / 568 tests passed（1 skipped 既有）、typecheck、lint、production build、`git diff --check` 全绿；未运行 portable/installer。
- **冒烟（tmp/v112-smoke/run-smoke.mjs）**：**18/18，连跑 3 轮**——V1.11 课次链九项零回归（PDF canvas 像素/docx wrapper/md/png/.doc unsupported/stderr）+ V112-A 带图 docx 课次渲染（内嵌 img data: URL + naturalWidth 实解码）+ V112-B 外部资料页八项（PDF canvas 像素 + 逃生门、带图 docx data: URL、md MarkdownDocument、txt pre、png img、.doc 不可预览卡 + 打开按钮、纯文字 docx wrapper）。
- **冒烟脚本缺陷如实记录**：首轮外部 6 场景 FAIL 系脚本 pollExternal 双箭头包装 bug（返回函数对象未求值），经临时诊断块（API 直调 + DOM dump）确认通道/UI 实际正常后修正包装并删除探针，3 连跑全绿。
- **复核**：冒烟后 Electron 进程零残留、`teacher-workbench-v112-smoke-*` 临时目录零残留。
- **验收记录**：`docs/v1.12-acceptance.md`（实施表/自动门/冒烟记录/安全边界复核/走查清单/已知限制）。
- **状态同步**：STATUS.md、GOAL_PROGRESS.md、本文件 DONE；AGENTS.md V1.12 段更新为节点全完成。
- `checkpoint-V1.12-pass` 未创建——待产品负责人按验收文档 §5 走查清单确认。
