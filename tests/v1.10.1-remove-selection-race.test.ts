import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/**
 * V1.10.1（D65）：移除资料竞态修复——单份与批量移除在软删后必须先 reload 拿到新列表，
 * 再清空选中；旧实现「先清选中、后 reload」会让清空瞬间的旧列表触发阅读器自动重选
 * 已删文件（choosePreferredFile 仍命中软删行），连发注定失败的 files:read-content
 * 与 mineru:get-status 双请求（主进程守卫各记一条 error 日志，阅读器闪错误文案）。
 */
describe('V1.10.1 移除资料选中重置竞态', () => {
  it('removeFile: softDeleteFile → reload → 按需清选中（函数式更新，顺序不可倒置）', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    const deleteAt = section.indexOf('await window.teacherWorkbench.files.softDeleteFile({ fileId })')
    const reloadAt = section.indexOf('await reload()', deleteAt)
    const clearAt = section.indexOf("setSelectedFileId((current) => current === fileId ? '' : current)", reloadAt)
    expect(deleteAt).toBeGreaterThan(-1)
    expect(reloadAt).toBeGreaterThan(deleteAt)
    expect(clearAt).toBeGreaterThan(reloadAt)
    // 清选中必须是函数式更新：await 期间用户改选了别的文件则保留，不回退旧闭包值
    expect(section).toContain("setSelectedFileId((current) => current === fileId ? '' : current)")
    // 旧顺序（清选中在 reload 之前）不得回归
    expect(section).not.toMatch(/setSelectedFileId\(''\)\s*\n\s*await reload\(\)/)
  })

  it('removeSelectedFiles（批量）：串行软删 → reload → 按需清选中', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    const batchDeleteAt = section.indexOf('await window.teacherWorkbench.files.softDeleteFile({ fileId: file.id })')
    const reloadAt = section.indexOf('await reload()', batchDeleteAt)
    const clearAt = section.indexOf("setSelectedFileId((current) => manageSelectedIds.includes(current) ? '' : current)", reloadAt)
    expect(batchDeleteAt).toBeGreaterThan(-1)
    expect(reloadAt).toBeGreaterThan(batchDeleteAt)
    expect(clearAt).toBeGreaterThan(reloadAt)
  })

  it('阅读器自动重选仅在选中文件不在当前列表时触发（既有语义，本补丁不动）', () => {
    const reader = source('../src/renderer/lesson-material-reader.tsx')
    expect(reader).toContain('if (selectedFile !== null) return')
    expect(reader).toContain('choosePreferredFile(files)')
  })

  it('主进程守卫语义不变：软删文件仍被 requireActiveFile 拒读（本补丁零 IPC/零 Main 改动）', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    // 修复仅调整 Renderer 侧顺序，全部移除路径仍走既有 softDeleteFile，无新通道
    expect(section.match(/files\.softDeleteFile/g)?.length).toBe(2)
  })
})
