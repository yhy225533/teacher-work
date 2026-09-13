# V114-B · 新建双入口 + 创建后直进编辑 + 树降噪四件套

状态：TODO

## 目标

课件区可一键新建讲义（⋯ 菜单 + 讲义组头 ＋），创建后自动进编辑器；树降噪（空组一行化/树头去重/徽标降噪/启发式补词）。

## 前置产物

- V114-A 完成；方案 §2；D83/D84。

## 任务内容

1. `lesson-files-section.tsx`：`createLectureDoc`（requestText 默认名=课次标题 → createLessonDoc → reload → 选中 + setEditing(true) + notice）；⋯ 菜单"本课"组第一位「＋ 新建讲义」（readOnly 不渲染）；树头传 `treeTitle=""` 去重；
2. `lesson-material-reader.tsx`：grouped 渲染——空组标题"· 暂无"、删除各组空态 <p>（整课 0 文件空态文案合并引导）；讲义组头「＋」（onAddLectureDoc prop，readOnly 不渲染）；来源徽标改 `lessonFileBadgeLabel`（外部资料 → null）；整课空态文案更新；
3. `lesson-prep-context.ts`：新助手 `lessonFileBadgeLabel`；exercise 词表追加 `特训|精练|全解全析|分层|\d{1,3}题`；META emptyText 退役；
4. styles.css：组头 ＋ 按钮样式（紧凑，同 tree-group-menu-btn 基调）；
5. 测试：启发式新词钉测、空组一行/组头 ＋/徽标降噪/树头去重渲染钉测、新建流程源码钉测；演进 v1.8.1/v1.9/v1.13 既有徽标与空态钉测。

## 门禁

相关测试 + typecheck + lint + build 全绿。

## 完成记录

（待填）
