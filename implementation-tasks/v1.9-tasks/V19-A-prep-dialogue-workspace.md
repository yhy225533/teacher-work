# V19-A · 备课工作台对话式重做

状态：TODO

## 目标

draft-panel 重排为「对话栏 + 主舞台」两栏：右栏 = 与 AI 对话（依据区 + "对 AI 说" + 发送，模式切换器撤除、自动挂当前讲义）；主舞台固定位置同卡替换（方案含题库候选与确认 / 生成中流式 / 成果 / 对比），页面零跳动；修改记录默认收起为顶部浮层按钮；成果编辑复用 MdEditor。生成/题库/发布逻辑零改动。

## 前置产物

- `docs/v1.9-teaching-ui-restructure-plan.md` §3（设计基准）
- `implementation-tasks/V1_9_DECISIONS.md` D55/D56/D59/D60
- 既有：`improvePhase` / `streamState` / `selectedNote` / `compareOpen` 阶段状态（draft-panel 现有）、`MdEditor`（V17-C/V1.7.3）、`PrepBankOptions`、`TeachingContentDrawer` 浮层视觉先例、`prep-add-card` 空态添加卡
- V1.7.2 四节点已实施完成（2026-09-07，自动门过、走查待产品负责人）：本节点在其落地结构之上重排——prep-rail 左轨改浮层、prep-mode-bar 撤除、prep-add-card 添加卡沿用、生成器收起/展开规则随生成器卡撤除退役；v1.7.2 钉测按新结构演进，验收语义不改写

## 任务内容

1. `src/renderer/draft-panel.tsx` 主结构重组（逻辑保留，展示层重排）：
   - 撤 `prep-mode-bar`；进入自动初始化：课次有 md → single + 当前讲义 chip（"自动"徽标）；无 md → new 从零生成（外部/素材库添加卡）；依据区 radio「这次改什么：这份讲义 ｜ 整个课件包（N 份）」映射 lesson；
   - 对话栏（302px）：依据区（自动 chip + 参考 chips（✕）+ ＋ 本课资料/外部/素材库 + 参考题库开关行含 PrepBankOptions）+ "对 AI 说" textarea（5 行）+ Skill + `✦ 发送`；生成中禁用；预算行简化为底部小字（D25 确认弹窗逻辑不动）；
   - 主舞台：方案态（方案正文 + 题库候选就地列表 + 底部 `✓ 确认并生成` / `让 AI 调整` / `放弃`）；生成态（思考行秒表+逐字正文+取消，同卡替换）；成果态（标题 + 未发布/已确认徽标 + 大阅读区 + `✎ 编辑` / `⇄ 新旧对比` / `⬆ 保存为新版本`(primary) / `⋯`（重新生成/保存到本次课次/查看课件/删除草稿红区））；对比态（同卡左右分栏）；空态引导；
   - 修改记录浮层：顶部 `🕘 修改记录 N` 按钮 + 浮层（drawer 视觉），条目=现 rail 行（节点/时间/教师版学生版徽标/状态/删除），选择即加载并关闭；全局"修改记录"分区（DraftPanel context=null 用法）不动；
   - 恢复提示、inline-notice/inline-error 置顶语义保留；1100px 窄窗堆叠 + 对话栏折叠摘要；
2. `src/renderer/md-editor.tsx` 受控用法：可选 `initialBody` + `onSaveBody(bodyMd)`（缺省 = 现行文件用法，`files:read-text`/`files:write-version` D29 语义与课件区调用零变化）；成果态 ✎ 编辑用 MdEditor（initialBody = note.bodyMd，保存 = 现行 saveModification note 语义），热保存键 `md-editor-draft:note:<noteId>` 隔离；取消丢弃；
3. `src/renderer/styles.css`：两栏 grid、对话栏、舞台四态、浮层样式（沿用设计令牌）；
4. 测试：
   - draft-panel 重组钉测：自动挂载规则（有/无 md）、radio 范围切换映射 lesson、"发送"按钮态、舞台四态渲染与同卡替换（流式不插卡）、确认/调整/放弃三键、成果三主键与 ⋯ 菜单、修改记录浮层开合与选择加载、删除草稿仍红区确认；
   - md-editor 双用法：文件用法零变化钉测（write-version 往返不变）+ note 用法（保存回 note、热保存键隔离、取消丢弃）；
   - 演进受影响钉测（v1.7.2-workspace-structure、static-render-v156-d、v17-d-bank-selection 等），验收语义不改写。

## 边界

- 零 IPC / 零 migration / 零新依赖；`prepMode`/`draft:generate` 载荷 `mode` 字段与 improve/生成/题库/发布/删除 IPC 全部零改动；
- 不持久化对话往返（D59），每轮产出仍是修改节点；不做步骤链/阶段编号；
- V1.6 流式通道、V17-D 题库两步流、D25 预算确认、draft_status 生命周期、软删除边界零变化；
- 教学内容页头（用户认可的短样式）与"退出修改"键不动。

## 验证

- 相关测试 + `npm run typecheck` + `npm run lint`。

## 完成记录

（待实施）
