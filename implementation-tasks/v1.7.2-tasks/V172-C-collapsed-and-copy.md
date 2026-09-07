# V172-C · 生成器收起态打磨与空态引导（D33）

**状态：** `DONE`

前置：V172-B `DONE`。方案基准：`docs/v1.7.2-prep-workspace-restructure-plan.md` §5.7、§6（规则 4-5）、§8（主区空态分模式文案）。

## 完成记录（2026-09-07）

- 收起态摘要三模式前缀/要求摘要（前 18 字省略号）/"调整要求"展开/规则 4-5（选中自动收起、取消强制展开、`improvePhase==='review'` 与流式中保持展开）已在 V172-A 落地，本任务补钉测防回归。
- 主区空态 `workspace-card draft-content-empty` 卡片化 + 分模式文案（§8）：new → "先添加生成依据（或直接写要求），点「生成讲义」即可出第一版…随时回看与继续修改"；single/lesson → "修改方案生成后先在这里审阅，确认后才会生成新副本；节点会出现在左侧修改记录里"；旧通用文案"左侧选择修改节点，或在上方生成新内容。正式课件的阅读在「课件」分区"退役。
- `improve-review-card` 核查（§5.2）：自带 `border: 1px solid #c7d2fe` + `padding: 12px` 独立卡片视觉，不需叠加 `workspace-card`，钉测锁边框/内边距。
- 1100px 以下堆叠走查并入 V172-D 隔离 Windows 冒烟（媒体查询 V172-A 已改写，本任务无代码改动）。
- 钉测：v1.7.2-workspace-structure 追加 3 例（空态分模式卡片、review-card 独立视觉、收起/展开规则防回归），共 15 例。
- 门禁：全量 83 files / 462 tests passed（1 skipped 既有）、typecheck、lint、production build 通过。

## 范围

- 收起态摘要完整规则：三模式前缀（修改对象 {文件名} / 修改范围 本课全部课件 / 生成依据 {n} 份）、要求摘要（trim 前 18 字 + 省略号 / 未填写）、`参考 {n} 份 · 题库{开|关}`；"调整要求"展开；
- §6 规则 4-5 核对落地：选中节点自动收起、`abandonImprove`/`startImprovePlan` 取消后强制展开；`improvePhase==='review'` 与流式中保持展开；
- 主区空态 `draft-content-empty` 分模式文案（§8）+ `workspace-card` 卡片化；`improve-review-card` 独立成卡核查（缺边框内边距则加 `workspace-card`）；
- 1100px 以下堆叠走查（rail 在上、main 在下，不破版）。

## 不做

- 一切 handler/生成逻辑改动；全量门禁（V172-D）。

## 验收

- `tests/v1.7.2-workspace-structure.test.ts` 补收起/展开规则断言（选中→收起；调整要求→展开；切换节点→保持收起；无选中→恒展开）；
- 阅读态收起下完成 编辑/新旧对比/重新生成/发布 全流程回归；
- typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.7.2(V172-C): collapsed generator and empty-state copy`。
