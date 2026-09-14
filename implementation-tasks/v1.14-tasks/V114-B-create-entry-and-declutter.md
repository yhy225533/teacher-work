# V114-B · 新建双入口 + 创建后直进编辑 + 分链显示与工具行重排 + 树降噪

状态：DONE

## 目标

课件区可一键新建讲义（⋯ 菜单 + 讲义组头 ＋），创建后自动进编辑器；版本链按基名分链显示 + 历史版本按需唤出（D86）；工具行重排（D87）；树降噪（空组一行化/树头去重/徽标降噪/启发式补词）。

## 前置产物

- V114-A 完成；方案 §1–§4；D83/D84/D86/D87。

## 任务内容

1. `lesson-prep-context.ts`：
   - **D86 分链**：`classifyLessonCoursewareFiles` 改为按基名聚合（` · 第 N 版` 去后缀；学生版不匹配 pattern 维持现状）——每链最高版进 currentMaterials、其余入 history（按链分组）；`currentVersion` = 各链头中 createdAt 最新（主讲义）；导出链基名助手（讲义组树行显示基名）；
   - `lessonFileBadgeLabel` 新助手（外部资料 → null；`lessonFileSourceLabel` 保留给需要完整来源的场景）；exercise 词表追加 `特训|精练|全解全析|分层|\d{1,3}题`；META emptyText 退役；
   - `orderAiEditableFiles` 排序演进为链内优先（分链后同链相邻、链头在前）；
2. `lesson-files-section.tsx`：
   - `createLectureDoc`（requestText 默认名=课次标题 → createLessonDoc → reload → 选中 + setEditing(true) + notice）；⋯ 菜单"本课"组第一位「＋ 新建讲义」（readOnly 不渲染）；树头传 `treeTitle=""` 去重；
   - **D86**：hover ✕ 白名单（`removableFileIds`）从"唯一当前版"改为"全部链头"；底部常驻历史 details 退役，改为 ⋯「本文件」组「🕘 历史版本（N）」（选中链头且链内旧版 > 0 时渲染）点击后展开 details（标题按链标注，默认展开）；
   - **D87**：工具行顺序 修改这份｜编辑｜导出 PDF｜⛶ 图标｜⋯；沉浸阅读 → `.toolbar-icon-btn`（title/aria-label 完整、激活态、进入后"退出沉浸阅读"）；readOnly = 导出 + ⛶ + ⋯；无 md 分支 = 引导 + AI 主键 + ⛶（不渲染 ⋯）；
3. `lesson-material-reader.tsx`：grouped 渲染——空组标题"· 暂无"、删除各组空态 <p>（整课 0 文件空态文案合并引导，含组头 ＋ 指引）；讲义组头「＋」（onAddLectureDoc prop，readOnly 不渲染）；讲义组树行显示基名（去版本后缀）；来源徽标改 `lessonFileBadgeLabel`；
4. styles.css：`.toolbar-icon-btn`、组头 ＋ 按钮样式（紧凑，同 tree-group-menu-btn 基调）；底部历史块仅 ⋯ 唤出后渲染；
5. 测试：分链 classify 钉测（两链并立/主讲义=最近创建链头/学生版随材料/单链与现状等价）、启发式新词钉测、空组一行/组头 ＋/徽标降噪/树头去重/历史按需（默认不渲染 + ⋯ 唤出 + 按链分组）/工具行顺序与 ⛶ 图标渲染钉测、新建流程源码钉测；演进 v1.8.1/v1.9/v1.13 既有徽标与空态钉测（含 draft-panel 消费 classify 的候选列表演进）。

## 门禁

相关测试 + typecheck + lint + build 全绿。

## 完成记录

2026-09-14 完成。

- **D86 分链 classify（lesson-prep-context.ts）**：`classifyLessonCoursewareFiles` 改为按基名聚合 ` · 第 N 版.md`（`chains` Map），每链版本降序取链头进 currentMaterials、其余按链入 history；链头按 `createdAt desc`（+id 兜底）排——主讲义 = 最近保存链头（修复单链假设：第二基名链头不再被误吞进历史）。新增 `lectureChainBaseName`（基名提取，学生版等非 pattern 名返回 null）与 `lectureChainHeads` 导出；META emptyText 全退役（空态改由树空组一行化承担）。
- **orderAiEditableFiles 分链演进**：链头在前、同链相邻（链内版本降序）、链间按链头 createdAt 降序（与 classify 主讲义语义一致——AI 单文件修改候选不再让旧链高版本号压过最近主讲义链头），非链 md 原序跟后；单链场景与 V17-B 冻结行为等价（v17-b 测试原样通过）。
- **D84 降噪**：`lessonFileBadgeLabel`（外部资料默认徽标 → null，素材库保留；`lessonFileSourceLabel` 完整语义不动，仍用于工具行胶囊）；exercise 词表追加 `特训|精练|全解全析|分层|\d{1,3}题`。
- **lesson-files-section.tsx**：`createLectureDoc()`（requestText 默认名=课次标题 → `files.createLessonDoc` → reload+reloadCore → 选中新建文件 → `setEditing(true)` 直进编辑态 + notice）；⋯ 菜单「本课」组第一位「＋ 新建讲义」（readOnly 不渲染）；hover ✕ 白名单 `removableFileIds` 扩至全部链头；底部常驻历史块退役 → `historyOpenFileId` 状态 + ⋯「本文件」组「🕘 历史版本（N）」按需唤出（选中链头且链内旧版 > 0 时渲染；切换选中文件自动收起）。
- **D87 工具行重排**：`immersiveButton` 提取为常量（`toolbar-icon-btn` 38px、aria-pressed、title/aria-label 完整语义），三分支统一渲染于 ⋯ 之前行尾位——主分支 修改这份｜编辑｜导出 PDF｜⛶｜⋯；无 md 分支 引导+AI 主键+⛶（不渲染 ⋯）；readOnly 导出+⛶+⋯。
- **lesson-material-reader.tsx**：讲义组头「＋」（onAddLectureDoc，readOnly 不渲染，hover 显现）；讲义组树行显示基名（`lectureChainBaseName` 回退 displayFileName）；空组一行化 `${label} · 暂无`（删除各组空态 <p>）；树头去重 `treeTitle=""`（树头只留 N 项计数）；来源徽标改用 `lessonFileBadgeLabel`；整课空文件态文案合并新建/AI 指引。
- **styles.css**：`.lesson-files-toolbar-actions .toolbar-icon-btn`（38px 方形、is-active 激活态）+ `.material-role-group-title .group-add-btn`（紧凑、hover 显现，同 tree-group-menu-btn 基调）。
- **测试**：lesson-prep-context.test.ts 新增 D86 describe（双链并立/主讲义=最近创建链头/单链等价/lectureChainBaseName/lessonFileBadgeLabel/orderAiEditableFiles 链内相邻）+ D83/D87 源码结构 describe（createLectureDoc 流程/双入口/历史按需/工具行顺序限 hasAnyMarkdown 分支/树头去重钉测）；v1.13-material-groups 演进（'核心4题' docx 落 exercise、'20260914.md' 纯数字兜底 misc 反例）；v1.8.1-courseware-groups（徽标降噪 + 空组一行化钉）；v1.9-courseware-toolbar（⛶ 图标钉 + 全宽文字按钮退役钉 + 历史按需钉）；v1.10-remove-entry-points（白名单=全部链头钉）。
- **门禁**：全量 102 files / 616 tests passed（1 skipped 既有）、typecheck、lint、production build 全绿。
