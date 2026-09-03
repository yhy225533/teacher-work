# V172-C · 生成器收起态打磨与空态引导（D33）

**状态：** `TODO`

前置：V172-B `DONE`。方案基准：`docs/v1.7.2-prep-workspace-restructure-plan.md` §5.7、§6（规则 4-5）、§8（主区空态分模式文案）。

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
