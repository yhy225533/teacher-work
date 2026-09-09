# V110-A · 备课状态保活（问题 5）

状态：TODO

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

（待实施）
