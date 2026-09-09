# V1101-A · 移除资料选中重置竞态修复（D65）

**状态：** `DONE`

方案与决策：`implementation-tasks/V1_10_DECISIONS.md` D65（V1.10 走查发现，V1.10 最终验收前维护增量）。走查现象：单份/批量移除资料瞬间，日志连出 `ipc.file_request_failed`（files:read-content，"文件已删除，请先恢复。"）与 `ipc.mineru_request_failed`（mineru:get-status，"文件不存在或已删除。"）两条 error，同一渲染帧发出（时间戳相差毫秒级），随后自愈。

## 根因

`lesson-files-section.tsx` 单份 `removeFile` 与批量 `removeSelectedFiles` 的顺序均为「先 `setSelectedFileId('')`、后 `await reload()`」。清空选中渲染的瞬间 `displayFiles` 仍是旧列表（reload 未完成，仍含已软删文件），`LessonMaterialReader` 的自动重选 effect（`selectedFile === null` → `choosePreferredFile(files)`）从旧列表里把刚删的文件重新设为选中；随后 `files:read-content`（lesson-material-reader.tsx read effect）与 `mineru:get-status`（lesson-files-section.tsx status effect）两条 IPC 打到已软删文件上，主进程 `requireActiveFile` / `MineruService.getStatus` 按设计拒绝并各记一条 error。reload 完成后选中落到有效文件（或清空），自愈。竞态并非 V1.10 新引入（`removeFile` 旧序早于 V110-B），V1.10 的三层移除入口（hover ✕ / ⋯ / 历史 ✕ / 批量）提高了触发概率。

## 修复（Renderer 侧顺序调整，一处语义两处调用点）

- 单份 `removeFile`：`await softDeleteFile` → **先 `await reload()`** → `setSelectedFileId((current) => current === fileId ? '' : current)`；
- 批量 `removeSelectedFiles`：串行软删 → **先 `await reload()`** → `setSelectedFileId((current) => manageSelectedIds.includes(current) ? '' : current)`；
- 函数式更新：仅当此刻仍选中已删文件时才清空——await 期间用户改选了别的文件则保留，且 reload 落库后渲染若已自动重选有效文件，清空条件不匹配即保留新选择；
- 三条移除入口（树 hover ✕、⋯ 菜单、历史版本 ✕）全部汇入 `removeFile`，批量入口汇入 `removeSelectedFiles`，无第三条路径。

## 不做

- 阅读器自动重选逻辑（`choosePreferredFile` / `if (selectedFile !== null) return`）不动——语义正确，问题只在调用方喂了旧列表；
- 主进程守卫、IPC、合同、migration、依赖零改动——`requireActiveFile` 拒读已删文件是安全边界，保留；
- `softDeleteFile` 不补发 `contentChanged` 广播（D61 只覆盖 copyToLesson/importToLesson 导入路径；删除路径由调用方 reload 收口，本补丁不改广播面）；
- 不重做 V1.10 冻结语义（D62 三层入口结构、白名单、确认弹窗均不动）。

## 验收

- 新增 `tests/v1.10.1-remove-selection-race.test.ts` 4 例（顺序钉测：软删 → reload → 按需清选中，单份与批量各一；函数式更新钉测；旧顺序不得回归；零 IPC 面钉测）；
- 既有钉测无需演进（v1.10-remove-entry-points / v1.9-courseware-toolbar 未钉移除内部顺序）；
- 全量测试、typecheck、lint；本补丁为纯 Renderer 顺序修复，不新增 build 风险，production build 与隔离 Windows 冒烟按 V110-D 门禁复跑（重点场景 B 移除入口，观察 stderr 无 file_request_failed/mineru_request_failed）；
- 验收并入 `docs/v1.10-acceptance.md`（追加 V1.10.1 证据小节，不改写 V110 历史记录）；不创建 `checkpoint-V1.10.1-pass`，`checkpoint-V1.10-pass` 仍待产品负责人走查确认（V1.5.3.1 先例：维护增量并入母版本验收）。

## 完成记录（2026-09-09）

- `lesson-files-section.tsx` 两处调用点顺序修复 + 函数式清选中（单份 `removeFile` / 批量 `removeSelectedFiles`），行内注释标注 V1.10.1/D65；
- `tests/v1.10.1-remove-selection-race.test.ts` 4 例钉测全绿；
- 门禁：全量 95 files / 538 tests（1 skipped 既有）、typecheck、lint、production build、`git diff --check` 全绿；
- 隔离 Windows 冒烟复跑：移除场景（树 ✕ 单删 / 批量移除 / 历史 ✕）stderr 零 `file_request_failed` / `mineru_request_failed`，修复前该场景稳定复现两条 error；
- Git：本地提交 `v1.10.1(V1101-A): fix remove-then-reselect race in lesson files section`；随后 push（沿用 GitHub 授权）。
