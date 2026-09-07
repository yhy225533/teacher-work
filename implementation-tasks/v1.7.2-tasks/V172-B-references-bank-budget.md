# V172-B · 参考行 chips、题库开关一行化与参数迁移（D33）

**状态：** `DONE`

前置：V172-A `DONE`。方案基准：`docs/v1.7.2-prep-workspace-restructure-plan.md` §5.5（参考行/预算行）、§5.6、§5.8、§7（对应 CSS）、§8（文案全量落地）。

## 完成记录（2026-09-07）

- 参考行/预算行/题库开关一行化已在 V172-A + V172-fix 提前落地，本任务实际完成剩余两项：
  ① new 冷启动两张 `prep-add-card` 大卡（0 选中时取代常驻勾选列表与小按钮行；有选中时切回 chips + 三个小入口 + 题库开关，与参考行同构）；`prep-add-cards`/`prep-add-card`/`prep-add-card-plus` CSS 落地。
  ② `PrepBankOptions` 唯一实例迁入 `improve-bank-section` 头部 `prep-bank-controls`（目标题数/学生版 + "正在选题…"同处），参考行与生成依据行的行内过渡态删除；`prep-bank-toggle`/`prep-bank-options` CSS 退役，`prep-bank-count-input` 保留。
- 钉测演进：v1.7.2-workspace-structure 新增 2 例（候选区头部唯一实例 + 冷启动大卡/选中 chips）；V172-fix 入口钉测 2→3 处（新增大卡入口）；static-render-v156-d 加载态断言按真实行为演进（`files === null` 时只有"正在读取本次资料…"，大卡在资料就绪后渲染）。
- 门禁：全量 83 files / 459 tests passed（1 skipped 既有）、typecheck、lint、production build 通过。

## 范围

- 参考行（single/lesson）：已选 chips（✕ 移除 = `toggleReferenceFile`）、`refPickerOpen` 展开 `ScopeFileList` 勾选候选、`＋ 本课资料 / ＋ 外部资料 / ＋ 素材库` 三个入口、参考题库 CSS switch 行（未安装置灰 + title 提示）；
- new 模式"生成依据"行：0 选中时冷启动两张 `prep-add-card` + muted 提示 + （有候选时）"＋ 从本课资料选择"；有选中时与参考行同构，label"生成依据"；
- 预算行：meter + `budgetPct` + §5.5 拼接规则文案（含超预算 `is-over`）；
- 题库参数迁移：目标题数 select + 同时生成学生版 checkbox 从配置区移入 `improve-bank-section` 头部 `.prep-bank-controls`（onChange 逻辑原样：改目标题数即 `clearBankSelection`）；
- 删除 `prep-bank-toggle`/`prep-bank-options`、`prep-source-actions` JSX 及 §7 删除清单对应 CSS；
- §8 文案对照表全部落地。

## 不做

- 收起态摘要细化与空态分模式文案（V172-C）；一切 handler/生成逻辑改动。

## 验收

- `tests/v1.7.2-workspace-structure.test.ts` 补 §10.4/5/6/7 断言；四文件钉测演进后全绿；`tests/draft-scope.test.ts`、`tests/v17-b-widen-scope.test.ts` 零改动通过；
- 开发窗口四态走查：new（0 选中/有选中）× 题库开/关 + single + lesson；
- typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.7.2(V172-B): reference chips, bank switch row and control migration`。

## D35 备注（2026-09-04，V172-A 同步落地）

- 产品负责人于 V172-A 验收同日新增 D35：目标题数可选可填写、上限 80。已在 V172-A 提交内同步落地：合同 `DRAFT_BANK_PLAN_MAX_TARGET_COUNT` 20→80（`normalizeTargetCount`/`isFallbackTargetCount` 改用常量）；UI 抽出 `PrepBankOptions` 组件（number input + datalist 快捷项，失焦收口：超限钳 80、清空/非法回退已提交值），过渡态暂渲染于参考行/生成依据行内。
- 本任务（V172-B）执行 §5.8 时把 `PrepBankOptions` 整体迁往候选区头部 `.prep-bank-controls`，组件本身不再改动；`prep-bank-toggle` CSS 删除清单相应扩大（含 `.prep-bank-count-input` 保留、`.prep-bank-options` 随组件走）。钉测见 `tests/v1.7.2-workspace-structure.test.ts` D35 断言。
