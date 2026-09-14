# V114-B · 新建双入口 + 创建后直进编辑 + 分链显示与工具行重排 + 树降噪

状态：TODO

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

（待填）
