# V114-C · 最终门禁与验收

状态：DONE

## 目标

全量门禁 + 隔离冒烟（新建→编辑→版本链复验 + 降噪树断言）+ 验收文档。

## 任务内容

1. 全量测试、typecheck、lint、production build、`git diff --check`；
2. 隔离 Windows 冒烟：新建讲义（弹窗默认名 → 创建）→ 自动进编辑器 → 保存 → `名称 · 第 2 版.md` 版链复验；**D86 多链场景**——再以自定义名新建第二份讲义 → 新链头并立显示于讲义组（基名行、不进历史块）→ 选中可编辑/保存 → ⋯「本文件」组出现「🕘 历史版本（N）」且按链分组（默认页面无历史块）；
   **D87**——工具行顺序 修改这份｜编辑｜导出 PDF｜⛶｜⋯，⛶ 为图标按钮且可进入/退出沉浸阅读；降噪断言（空组一行化/无重复树头/无外部资料徽标/组头 ＋ 可用/80题文件落习题与作业）；stderr 健康；
3. `docs/v1.14-acceptance.md`；STATUS/GOAL 收口；里程碑提交。

## 门禁

全部自动门绿 + 冒烟全过 + 验收文档齐备。`checkpoint-V1.14-pass` 待产品负责人走查确认后创建。

## 完成记录

2026-09-14 完成。

- **全量门禁**：102 files / 616 tests passed（1 skipped 既有）、typecheck、lint、production build、`git diff --check` 全绿。
- **冒烟中发现并修复 1 处真实产品缺陷**：「创建后直进编辑态」被 V19-B（D57）遗留的「切文件退出编辑」effect 反清（`setSelectedFileId` 与 `setEditing(true)` 同批提交，effect 随后清掉编辑态）——探针 `probe-edit-entry.mjs` 实证（notice/胶囊已更新但 `.md-editor` 不出现）。修复 = `enterEditingRef` 进入编辑意图标记（创建流程置 ref → 选中变化 effect 消费置 `editing=true`；手动切文件仍保持退出编辑冻结语义）；钉测同步演进；修复后全量门禁复跑全绿。
- **隔离 Windows 冒烟 15/15 × 连跑 3 轮**（`tmp/v114-smoke/run-smoke.mjs`，V113-C 框架）：fixture/挂课、D84 降噪四断言（80题落习题/空组一行化/树头去重/外部资料徽标 0 个）、D87 工具行顺序 + ⛶ 38px 图标切换、D83 组头 ＋ 默认名 + **创建后编辑器直接打开**、保存第 2 版版链、D86 多链并立（自定义名新链头基名行不进历史）、历史按需唤出（按链标注「「基名」历史版本（1）」）+ 切换自动收起、白名单两链头无 hover ✕、落库六文件、stderr 健康。
- 冒烟脚本两处断言侧修正（非产品）：期中真题卷命中 exercise 词「真题」属正确行为（fixture 改「期末模拟卷」）；⋯ 在 `span.app-menu` 容器、树行文本含 ▤ 图标与「当前」徽标（探针 `probe-history-menu.mjs` 定位），选择器相应修正。
- **验收文档**：`docs/v1.14-acceptance.md`（交付/门禁/冒烟 15 表/缺陷记录/走查清单）。
- `checkpoint-V1.14-pass` 待产品负责人走查确认后创建。
