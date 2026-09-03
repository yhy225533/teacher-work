# V172-A · 工作台骨架重排与修改记录左轨（D33）

**状态：** `TODO`

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
