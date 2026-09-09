import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/**
 * V110-A（D61）：备课资料选择往返保活——「＋ 外部资料 / ＋ 素材库」打开 picker 时不卸载
 * 教学内容页（DraftPanel 勾选/要求/模式/流式状态不丢），picker 以覆盖层呈现；
 * 侧边栏直接切页仍走卸载路径。Main 侧 copyToLesson/importToLesson 补发既有
 * contentChanged 广播，DraftPanel 挂载期间订阅该事件跟随新导入文件。
 */
describe('V110-A 备课状态保活', () => {
  it('App keeps TeachingContentPage mounted while pickers open as overlays (no setActiveItem detour)', () => {
    const app = source('../src/renderer/App.tsx')
    // picker 打开不再切页（旧 bug：setActiveItem('外部资料'/'素材库') 卸载教学内容页）
    expect(app).not.toContain("setActiveItem('外部资料')")
    expect(app).not.toContain("setActiveItem('素材库')")
    // onOpenExternal/onOpenMaterials 只置 picker flag + prepContext
    const externalOpen = app.slice(app.indexOf('onOpenExternal={(context)'), app.indexOf('onOpenMaterials'))
    expect(externalOpen).toContain('setExternalPickerOpen(true)')
    expect(externalOpen).not.toContain('setActiveItem')
    const materialsOpen = app.slice(app.indexOf('onOpenMaterials={(context)'), app.indexOf('onOpenMaterials') + 400)
    expect(materialsOpen).toContain('setMaterialPickerOpen(true)')
    expect(materialsOpen).not.toContain('setActiveItem')
    // picker 浮层渲染在教学内容页分支内（同一 fragment，教学内容页保持挂载）
    expect(app).toContain("{externalPickerOpen && prepContext !== null && (")
    expect(app).toContain('prep-picker-overlay')
    expect(app).toContain("{materialPickerOpen && prepContext !== null && (")
    // picker 浮层挂在 activeItem === '教学内容' 分支内（保活条件本体）
    const teachingBranch = app.slice(app.indexOf("activeItem === '教学内容'"), app.indexOf("placeholder-card"))
    expect(teachingBranch).toContain('<TeachingContentPage')
    expect(teachingBranch).toContain('<ExternalLibraryPanel')
    expect(teachingBranch).toContain('<MaterialPickerPanel')
    // returnToPrep 收起浮层并回到教学内容（activeItem 切换保留为显式导航语义）
    const returnToPrep = app.slice(app.indexOf('function returnToPrep'), app.indexOf('function openCourse'))
    expect(returnToPrep).toContain('setActiveItem(\'教学内容\')')
    expect(returnToPrep).toContain('setExternalPickerOpen(false)')
    expect(returnToPrep).toContain('setMaterialPickerOpen(false)')
  })

  it('sidebar navigation away still closes pickers (explicit leave semantics unchanged)', () => {
    const app = source('../src/renderer/App.tsx')
    const navigate = app.slice(app.indexOf('function navigate'), app.indexOf('function startPrep'))
    expect(navigate).toContain('setExternalPickerOpen(false)')
    expect(navigate).toContain('setMaterialPickerOpen(false)')
  })

  it('DraftPanel subscribes to contentChanged so keep-alive sees newly imported files', () => {
    const panel = source('../src/renderer/draft-panel.tsx')
    expect(panel).toContain('window.teacherWorkbench.files.onContentChanged(() => {')
    // 订阅经 reload 重拉 files，reconcile 并入新文件、保留既有选择（既有函数，零改动）
    expect(panel).toContain('void reload()')
    expect(panel).toContain('reconcileSelectedLessonFileIds(current, previousKnown, lessonFiles)')
  })

  it('Main broadcasts contentChanged for both picker copy paths', () => {
    const externalIpc = source('../src/main/ipc/external-library-ipc.ts')
    // 外部资料 → 课次副本 / 素材库副本两条路径都广播
    expect(externalIpc.match(/notifyContentChanged\?\.\(/g)?.length).toBe(2)
    const fileIpc = source('../src/main/ipc/file-ipc.ts')
    // 素材库 → 课次副本（files:copy-to-lesson）也广播
    const copyLessonBranch = fileIpc.slice(fileIpc.indexOf('FILE_IPC_CHANNELS.copyToLesson'), fileIpc.indexOf('FILE_IPC_CHANNELS.copyToStudent'))
    expect(copyLessonBranch).toContain('notifyContentChanged({')
    expect(copyLessonBranch).toContain('contentChanged: true')
    // 广播载荷不含路径（既有事件合同：fileId/contentChanged/file）
    expect(copyLessonBranch).not.toContain('path')
  })

  it('overlay styles present; picker panels scoped inside overlay', () => {
    const styles = source('../src/renderer/styles.css')
    expect(styles).toContain('.prep-picker-overlay {')
    expect(styles).toContain('.prep-picker-overlay .external-library-panel,')
    expect(styles).toContain('.prep-picker-overlay .material-picker-panel {')
  })
})
