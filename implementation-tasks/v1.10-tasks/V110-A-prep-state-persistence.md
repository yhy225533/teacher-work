# V110-A · 备课状态保活（问题 5）

状态：DONE

## 目标

「＋ 外部资料」「＋ 素材库」往返期间不卸载教学内容页，DraftPanel 勾选/要求/模式/流式状态原样保留；Main 侧 copyToLesson/importToLesson 补发既有 contentChanged 广播。

## 前置产物

- `docs/v1.10-walkthrough-fixes-plan.md` §2（根因与修复方案）；D61。

## 任务内容

1. `src/renderer/App.tsx`：picker 打开时（externalPickerOpen/materialPickerOpen && prepContext !== null）教学内容页保持挂载（不被 activeItem 切换卸载），picker 面板以独立渲染位覆盖/旁挂；`returnToPrep` 收起后回到原状态。侧边栏直接切页仍走原卸载路径（语义不变）；
2. picker 面板（ExternalLibraryPanel/MaterialPickerPanel）props 适配（context 经 prepContext 传入，onAdded/onCancel/onHidden → returnToPrep），面板内部逻辑零改动；
3. `src/main/ipc/external-library-ipc.ts`：copyToLesson/importToLesson 在 enqueueIndex 后补发 notifyContentChanged（既有广播，载荷不变）；
4. tests：App 渲染结构钉测（picker 模式下教学内容页仍挂载 + picker 面板并存）；external-library-ipc 往返测试补 contentChanged 断言；既有测试演进。

## 门禁

相关测试 + typecheck + lint 全绿；侧边栏切页/返回课程等既有导航路径零回归。

## 完成记录

2026-09-09 完成：

- **Renderer 保活（App.tsx）**：onOpenExternal/onOpenMaterials 不再 setActiveItem 切页，只置 externalPickerOpen/materialPickerOpen + prepContext；教学内容页分支内以 `.prep-picker-overlay` 覆盖层渲染 ExternalLibraryPanel/MaterialPickerPanel（TeachingContentPage 持续挂载，DraftPanel 勾选/要求/模式/流式状态不丢）；returnToPrep 收起浮层回教学内容；侧边栏 navigate 切页仍关 picker 走原卸载路径（主动离开语义不变）。外部资料/素材库独立页面分支回归纯浏览形态（prepContext=null，无"返回备课"）。
- **Main 补广播（D61）**：external-library-ipc 的 copyToLibrary/copyToLesson（外部资料两条路径）与 file-ipc 的 copyToLesson（素材库路径）在 enqueueIndex 后补发既有 notifyContentChanged（可选注入依赖，registerExternalLibraryIpc 接线 emitContentChanged）；载荷沿用既有事件合同（fileId/contentChanged/file，无路径）。
- **DraftPanel 订阅（draft-panel.tsx）**：新增 files.onContentChanged → reload() 订阅——保活期间新导入文件经广播触发重拉，reconcileSelectedLessonFileIds 并入新文件且保留既有选择。
- **测试**：新增 tests/v1.10-prep-state-keepalive.test.ts 5 例（保活渲染结构/侧边栏切页关浮层/DraftPanel 订阅/Main 双路径广播含载荷无路径/覆盖层样式）；演进 external-library-ipc.test.ts（copyToLibrary/copyToLesson 各广播一次断言）与 file-ipc.test.ts（copy-to-lesson 广播断言）。门禁：全量 92 files / 526 tests passed（1 skipped 既有）、typecheck、lint 全绿。
- 注：CourseDetail 的 overviewRevision 兜底重拉（V19-F）保留不删——双保险。
