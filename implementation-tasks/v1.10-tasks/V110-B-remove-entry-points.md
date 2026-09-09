# V110-B · 资料移除可达性（问题 1）

状态：DONE

## 目标

课件资料树：节点 hover ✕ 快捷移除、批量管理模式（勾选多份一次移除）、历史版本行移除入口；全部走既有 files.softDeleteFile，零新 IPC。

## 前置产物

- `docs/v1.10-walkthrough-fixes-plan.md` §3；D62。

## 任务内容

1. `src/renderer/lesson-material-reader.tsx`：MaterialTreeNodeRow hover ✕（editable 且非当前讲义当前版）；树标题「管理」toggle + 管理态多选（复用 selectedFileIds/checkbox）；
2. `src/renderer/lesson-files-section.tsx`：✕ 点击与批量「移除所选 (N)」编排（确认弹窗列文件名清单 + 原件不受影响文案；串行 softDeleteFile；完成退出管理态）；🕘 历史版本折叠块每行 ✕（同款确认）；
3. 保护规则：当前讲义当前版不出 ✕（保留 ⋯ 入口）；readOnly 不出 ✕/不出管理 toggle；⋯ 菜单红区入口保留兜底；
4. `src/renderer/styles.css`：hover ✕、管理态、确认清单样式；
5. tests：钉测（hover ✕ 条件矩阵 / 管理态多选与批量确认 / 历史版本 ✕ / readOnly 零入口 / ⋯ 入口保留）。

## 门禁

相关测试 + typecheck + lint 全绿；V1.8.1 分组树与阅读器既有钉测零回归。

## 完成记录

2026-09-09 完成：

- **树 hover ✕（MaterialTreeNodeRow）**：非管理态 + canRemove（onRemoveFile 存在且在 removableFileIds 白名单内）渲染 `✕`；title 引导"从本课移除（素材库/外部原件不受影响）"；白名单 = 全部当前资料 − 当前讲义当前版（唯一正文保护，仍只走 ⋯ 入口）。
- **批量管理**：树标题「管理/✓ 完成」toggle（readOnly 不显示）；管理态行首 checkbox（替换展开箭头位）+ 底部 `lesson-manage-bar`（已勾选 N + danger「移除所选（N）」+ 取消）；确认弹窗列文件名清单（confirm-file-list）+ 原件不受影响文案；串行逐份 softDeleteFile（无批量通道）；中途失败 reload + 部分成功提示；完成自动退出管理态。
- **历史版本 ✕**：折叠块每行 ✕（readOnly 隐藏），走同一 removeFile 确认；「系统打开」保留。
- **readOnly 零入口**：onRemoveFile/onToggleManageMode 按 !readOnly 传 undefined；历史 ✕ 同条件；⋯ 红区兜底保留（V19-B/D57）。
- **测试**：新增 tests/v1.10-remove-entry-points.test.ts 5 例（✕ 条件矩阵/批量编排与白名单/readOnly 零入口/历史版本/样式）；演进 material-library-ui.test.ts 1 处（"reader 无 onRemoveFile"的 V19-B 钉测按 D62 更新为"reader 渲染 ✕、编排仍在 section"）。门禁：全量 93 files / 531 tests passed（1 skipped 既有）、typecheck、lint 全绿。
