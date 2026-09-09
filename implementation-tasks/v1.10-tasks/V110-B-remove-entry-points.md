# V110-B · 资料移除可达性（问题 1）

状态：TODO

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

（待实施）
