# V172-A · 工作台骨架重排与修改记录左轨（D33）

**状态：** `DONE`

方案基准：`docs/v1.7.2-prep-workspace-restructure-plan.md` §5.2、§5.3、§5.4、§5.5（范围行）、§5.7、§7（骨架/左轨/范围行 CSS）、§6（新 state 与规则 1-5）。

## 范围

- `draft-panel.tsx`：工作台 DOM 重排为 `prep-rail`（左轨·修改记录）+ `prep-main`（主区）；成果区包 `workspace-card prep-doc-card`；删除 `prep-ref-panel`、`prep-work-panel`、三个旧 `card-heading`、`prep-auto-scope`、`prep-scope-strip`；grid 列改 `250px minmax(0,1fr)`；媒体查询改写；
- 范围行：single 目标卡（文件名/字数/当前版/更换展开 ScopeFileList radio）、lesson `prep-auto-chip`；new 模式本任务允许过渡态（旧列表整块搬入生成器行内）；
- 新 state：`targetPickerOpen`、`generatorOpen` + §6 规则 1-5（含收起态条渲染）；
- CSS：§7 骨架/左轨/范围行/收起条各条；删除清单中本任务对应项（删前 grep 确认无他处引用；`styles.css:1229` 共享选择器行保留）。

## 不做

- 参考行 chips、题库 switch 一行化、预算行 meter、题库参数迁移、new 冷启动大卡（V172-B）；主区空态分模式文案与 `improve-review-card` 卡片化核查（V172-C）；
- 一切 handler/生成逻辑/IPC/合同改动；`AGENTS.md` 修改。

## 验收

- 相关钉测演进（先 `grep -n "补充参考\|prep-ref-panel\|prep-scope\|这次想怎么改\|修改范围：" tests/` 定位）+ 新增 `tests/v1.7.2-workspace-structure.test.ts`（断言清单 §10.1/2/3/8/9 首批）；
- 三模式开发窗口渲染无错误；`prep-ref-panel`/`prep-work-panel`/`prep-scope-strip` 字符串在 `src/` 不再出现；
- typecheck、lint；更新 STATUS/GOAL_PROGRESS；提交 `v1.7.2(V172-A): rail skeleton and scope row`。

## 完成记录（2026-09-04）

- `draft-panel.tsx`：工作台重排为 `prep-rail`（250px 左轨：修改记录时间线 + 空态文案 + 脚注，列表项 JSX 原样搬入）+ `prep-main`（生成器卡/收起条/流式/方案/候选/成果卡）；成果区包 `workspace-card prep-doc-card`；删除 `prep-ref-panel`、`prep-work-panel`、`prep-scope-strip`、`prep-auto-scope`、三个旧 `card-heading`、`prep-bank-toggle`/`prep-bank-options` 大块、`prep-source-actions`、`draft-prompt-block`。
- 新 state：`targetPickerOpen` / `refPickerOpen` / `generatorOpen`；规则 1-5 落地（选中目标即收起、模式切换重置、context 重置 effect 追加、`selectedNoteId` effect 自动收起/展开、`abandonImprove` 与 `startImprovePlan` 取消路径强制展开）。
- 生成器范围行：single 目标卡（MD 徽标/文件名/字数/当前版/类型 + 更换展开 ScopeFileList radio + 收起按钮，候选 >1 才显示更换）；lesson `prep-auto-chip`（本课全部课件 · N 份 · 自动纳入最新正式版）+ 输出说明 note；new 模式生成依据行（过渡态：整块 ScopeFileList + ＋从本课资料选择 + 题库 switch 行）。
- 参考行/题库开关/预算行/冷启动大卡按方案提前落地为接近 to-be 形态（chips + ＋三个入口 + CSS switch + meter 预算行）；题库"目标题数/同时生成学生版"作为过渡态暂随开关行内渲染（V172-B 迁往候选区头部）。
- `styles.css`：grid 改 `250px minmax(0,1fr)`；新增骨架/左轨/生成器行/目标卡/自动徽标/chips/switch/meter/要求区/收起条/成果卡全套（§7 值）；删除 `prep-auto-scope`/`prep-reference-section`/`prep-reference-hint`/`prep-scope-strip` 全组/`prep-ref-panel`/`prep-work-panel`/`draft-prompt-block`/`draft-prompt-actions`（`styles.css:1229` 共享选择器行保留未动）；媒体查询 1100px 改为 `.prep-rail` 取消 sticky 单列堆叠。
- 测试：新增 `tests/v1.7.2-workspace-structure.test.ts` 7 例（左轨/目标卡与更换收起/自动徽标/收起态规则/成果卡与 grid 250px/旧结构反向断言/文案更新）；演进 5 处钉测（v1.5.3.1 范围行与快捷生成锚点、v1.2 节头删除、v1.6 预算行句式、v17-D 开关 switch 化、static-render-v156-d 静态渲染断言——其失败输出完整验证了目标 DOM）。
- 门禁：全量 77 files / 369 tests（1 skipped 既有）、typecheck、lint 通过。未运行 build（V172-D 统一跑）。
