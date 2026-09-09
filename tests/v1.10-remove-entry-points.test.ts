import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/**
 * V110-B（D62）：资料移除可达性——树节点 hover ✕（当前讲义当前版除外）+ 批量管理态
 * （勾选多份一次移除）+ 历史版本行移除入口；全部走既有 files.softDeleteFile，零新 IPC；
 * readOnly 课程零移除入口；⋯ 菜单红区入口保留兜底。
 */
describe('V110-B 资料移除可达性', () => {
  it('tree node renders hover ✕ behind a removable whitelist; current lecture current version excluded', () => {
    const reader = source('../src/renderer/lesson-material-reader.tsx')
    // ✕ 按钮渲染条件：非管理态 + canRemove（onRemoveFile 存在 + 白名单）
    expect(reader).toContain('const canRemove = onRemoveFile !== undefined && (removableFileIds === null || removableFileIds.has(node.file.id))')
    expect(reader).toContain('{!manageMode && canRemove && (')
    expect(reader).toContain('material-reader-tree-remove')
    expect(reader).toContain('title="从本课移除（素材库/外部原件不受影响）"')
    // 树标题「管理/完成」toggle（调用方传入才显示）
    expect(reader).toContain("onToggleManageMode !== undefined && (")
    expect(reader).toContain("{manageMode ? '✓ 完成' : '管理'}")
    // 管理态：勾选 checkbox 替换展开箭头位
    expect(reader).toContain('{manageMode ? (')
    expect(reader).toContain('aria-label={`勾选移除${node.file.originalName}`}')
  })

  it('section owns batch state, serial softDeleteFile orchestration, and the whitelist', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    // 批量状态与白名单（当前讲义当前版 = 唯一例外）
    expect(section).toContain('const [manageMode, setManageMode] = useState(false)')
    expect(section).toContain('const [manageSelectedIds, setManageSelectedIds] = useState<string[]>([])')
    expect(section).toContain('if (currentVersionFile !== null) ids.delete(currentVersionFile.id)')
    // 批量确认：列文件名清单 + 原件不受影响文案
    expect(section).toContain('title: `从本课移除 ${targets.length} 份资料？`')
    expect(section).toContain('只移除本课的独立副本，不会影响素材库原件或外部资料。')
    // 串行逐份 softDeleteFile（与单份同语义，无批量通道）
    expect(section).toContain('await window.teacherWorkbench.files.softDeleteFile({ fileId: file.id })')
    // 移除条：数量 + danger 按钮 + 取消
    expect(section).toContain('移除所选（{manageSelectedIds.length}）')
    expect(section).toContain('lesson-manage-bar')
  })

  it('readOnly courses expose zero remove entry points; ⋯ menu red-zone entry stays', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    // hover ✕ 仅 !readOnly 传入；管理 toggle 同
    expect(section).toContain("onRemoveFile={!readOnly ? (fileId: string) => { void removeFile(fileId) } : undefined}")
    expect(section).toContain('onToggleManageMode={!readOnly ? toggleManageMode : undefined}')
    // 历史版本 ✕ 仅 !readOnly
    expect(section).toContain('{!readOnly && (\n                  <button\n                    className="material-reader-tree-remove"')
    // ⋯ 菜单红区兜底保留（V19-B/D57）
    expect(section).toContain("label: '从本课移除'")
    expect(section).toContain("danger: true")
  })

  it('history version rows gain the remove entry (managed copies only, current version not in history)', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    const historyBlock = section.slice(section.indexOf('lesson-history-block'), section.indexOf('lesson-manual-edit-notes'))
    expect(historyBlock).toContain('material-reader-tree-remove')
    expect(historyBlock).toContain('移除历史版本')
    // 既有「系统打开」保留
    expect(historyBlock).toContain('系统打开')
  })

  it('styles: hover ✕ / manage bar / confirm list present', () => {
    const styles = source('../src/renderer/styles.css')
    expect(styles).toContain('.material-reader-tree-remove {')
    expect(styles).toContain('.lesson-manage-bar {')
    expect(styles).toContain('.tree-manage-toggle {')
    expect(styles).toContain('.confirm-file-list {')
  })
})
