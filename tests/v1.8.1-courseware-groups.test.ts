import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(join(__dirname, '..', relativePath), 'utf8')
}

/** V1.8.1/D46 方案 A：课件区目录树讲义/材料分组 + 设为讲义底稿入口（结构钉测）。 */
describe('V1.8.1 课件区讲义/材料分组（方案 A）', () => {
  it('lesson-prep-context exports the pure split used by the tree', () => {
    const context = source('src/renderer/lesson-prep-context.ts')
    expect(context).toContain('export function splitLessonFilesByRole')
    expect(context).toContain('（编辑版）')
    expect(context).toContain('readonly lecture: readonly ManagedFileRecord[]')
    expect(context).toContain('readonly materials: readonly ManagedFileRecord[]')
  })

  it('LessonMaterialTree renders lecture/material groups only when grouped, with badges and empty hints', () => {
    const reader = source('src/renderer/lesson-material-reader.tsx')
    // 分组渲染与顺序：讲义组在前、材料组在后
    expect(reader).toContain('本课讲义')
    expect(reader).toContain('本课材料')
    expect(reader.indexOf('本课讲义')).toBeLessThan(reader.indexOf('本课材料'))
    // 当前徽标 + 来源标签（复用 lessonFileSourceLabel）
    expect(reader).toContain('material-role-badge is-current')
    expect(reader).toContain('material-role-badge is-source')
    expect(reader).toContain('lessonFileSourceLabel(node.file)')
    // 讲义组空态引导（与 V17-B 无 md 引导语义衔接）
    expect(reader).toContain('还没有讲义——选中材料区的 Markdown 可「设为讲义底稿」，或用 AI 生成第一版课件。')
    // grouped 默认 false：既有调用（draft-panel 等）零改动
    expect(reader).toContain('grouped = false')
    expect(reader).toContain('readonly grouped?: boolean')
  })

  it('lesson-files-section enables grouping in the courseware area and passes the current lecture', () => {
    const section = source('src/renderer/lesson-files-section.tsx')
    expect(section).toContain('grouped')
    expect(section).toContain('currentLectureId={currentVersionFile?.id ?? null}')
  })

  it('styles.css ships role-group titles, badges and empty-state hints', () => {
    const styles = source('src/renderer/styles.css')
    expect(styles).toContain('.material-role-group-title')
    expect(styles).toContain('.material-role-badge.is-current')
    expect(styles).toContain('.material-role-badge.is-source')
    expect(styles).toContain('.material-role-group-empty')
  })

  it('keeps frozen flows untouched: no draft-panel / classify / filter pipeline changes', () => {
    const draftPanel = source('src/renderer/draft-panel.tsx')
    expect(draftPanel).not.toContain('splitLessonFilesByRole')
    const context = source('src/renderer/lesson-prep-context.ts')
    // 既有 classify 管线签名不动
    expect(context).toContain('export function classifyLessonCoursewareFiles(')
    expect(context).toContain('export function filterLessonMaterialFiles(')
    expect(context).toContain('export function buildLessonMaterialTree(')
  })
  it('V181-B: exposes setLessonFileRole across contracts, IPC, preload and the courseware entry', () => {
    const contracts = source('src/shared/ipc-contracts.ts')
    expect(contracts).toContain("setLessonRole: 'files:set-lesson-role'")

    const ipc = source('src/main/ipc/file-ipc.ts')
    expect(ipc).toContain('FILE_IPC_CHANNELS.setLessonRole')
    expect(ipc).toContain('fileService.setLessonFileRole')

    const preload = source('src/preload/index.ts')
    expect(preload).toContain('setLessonFileRole: (request: FileIdRequest)')

    const preloadApi = source('src/shared/preload-api.ts')
    expect(preloadApi).toContain('setLessonFileRole: (request: FileIdRequest) => Promise<WriteFileVersionResult>')

    const service = source('src/main/files/managed-file-service.ts')
    expect(service).toContain('setLessonFileRole(fileId: string)')
    expect(service).toContain('原件不动（材料区保留）')

    // V19-B（D57）：设为讲义底稿入口并入课件区工具行 ⋯ 菜单（判定与语义不变）
    const section = source('src/renderer/lesson-files-section.tsx')
    expect(section).toContain('设为讲义底稿')
    expect(section).toContain('isLessonLectureFile(selectedFile)')
    expect(section).toContain('promoteToLecture')
    expect(section).toContain('原件保留在材料区')
  })

})
