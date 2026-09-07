import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

// V19-B（D57）课件区双头合并与操作收纳：三层头部 → 单条工具行（课次标题 + 文件信息胶囊 ｜
// 三主键 + 沉浸 + ⋯）；可见按钮 11+ → 5；低频/高危动作进 ⋯ 分组菜单（危险项底部红区）。
describe('V19-B 课件区合并工具行与 ⋯ 收纳', () => {
  describe('共用 ⋯ 菜单组件（app-menu.tsx）', () => {
    it('renders grouped entries with separators, danger zone and outside/Esc close', () => {
      const menu = source('../src/renderer/app-menu.tsx')

      // 分组小标题 / 菜单项 / 危险项 / 分隔线（任务文件第 1 条）
      expect(menu).toContain('AppMenuEntry')
      expect(menu).toContain("kind: 'separator'")
      expect(menu).toContain("kind: 'group'")
      expect(menu).toContain("danger === true ? 'is-danger'")
      expect(menu).toContain('app-menu-separator')
      expect(menu).toContain('app-menu-group')
      // 点击外部 / Esc / 窗口失焦/滚动 关闭（素材库右键菜单先例）
      expect(menu).toContain("window.addEventListener('pointerdown', close)")
      expect(menu).toContain("event.key === 'Escape'")
      expect(menu).toContain("window.addEventListener('blur', closePlain)")
      expect(menu).toContain("document.addEventListener('scroll', closePlain, true)")
      // 选择菜单项后自动关闭
      expect(menu).toContain('setOpen(false); entry.onSelect()')
      // a11y：aria-expanded / aria-haspopup / role=menu / menuitem
      expect(menu).toContain('aria-expanded={open}')
      expect(menu).toContain('aria-haspopup="menu"')
      expect(menu).toContain('role="menu"')
      expect(menu).toContain('role="menuitem"')
    })
  })

  describe('课件区单条合并工具行（lesson-files-section）', () => {
    it('renders lesson title once with the current-file info capsule', () => {
      const section = source('../src/renderer/lesson-files-section.tsx')
      const styles = source('../src/renderer/styles.css')

      // 课次标题同屏只出现 1 次（页面头/阅读器头退役）
      expect(section).toContain('lesson-files-toolbar')
      expect(section).toContain("periodTitle === '' ? lesson.title : `${periodTitle} · ${lesson.title}`")
      // 信息胶囊：文件名 · 当前徽标 · 大小 · 来源标签（lessonFileSourceLabel）
      expect(section).toContain('lesson-file-capsule')
      expect(section).toContain('formatBytes(selectedFile.sizeBytes)')
      expect(section).toContain("selectedFile.id === currentVersionFile?.id && <small className=\"is-current\">当前</small>")
      expect(section).toContain('lessonFileSourceLabel(selectedFile) !== null && <small className="is-source">')
      expect(section).toContain('未选择文件')
      expect(styles).toContain('.lesson-files-toolbar {')
      expect(styles).toContain('.lesson-file-capsule {')
      expect(styles).toContain('.lesson-file-capsule small.is-current {')
      expect(styles).toContain('.lesson-file-capsule small.is-source {')
    })

    it('keeps five visible actions: 修改这份 / 编辑 / 导出PDF占位 / 沉浸阅读 / ⋯', () => {
      const section = source('../src/renderer/lesson-files-section.tsx')

      // 三主键中的前两个 + 沉浸 + ⋯；⬇ 导出 PDF 本节点仅占位注释（V19-E 接线后渲染）
      expect(section).toContain('✦ 修改这份')
      expect(section).toContain("aria-pressed={editing}")
      expect(section).toContain("{editing ? '✓ 预览' : '✎ 编辑'}")
      expect(section).toContain('V19-E 接线后渲染：⬇ 导出 PDF（本节点仅占位）')
      expect(section).toContain("label=\"⋯\"")
      expect(section).not.toContain('>刷新</button>')
      expect(section).not.toContain('继续上次修改</button>')
      expect(section).not.toContain('整课重做</button>')
    })

    it('collects low-frequency and dangerous actions into the grouped menu with a red-zone tail', () => {
      const section = source('../src/renderer/lesson-files-section.tsx')

      // 分组"本课"：刷新 / 继续上次修改 / 整个课件包重做（lesson 范围）
      expect(section).toContain("label: '本课'")
      expect(section).toContain("kind: 'item', key: 'refresh', label: '刷新'")
      expect(section).toContain("kind: 'item', key: 'continue', label: '继续上次修改'")
      expect(section).toContain("label: '整个课件包重做'")
      expect(section).toContain('onSelect: rebuildLesson')
      // 分组"本文件"：设为讲义底稿 / 系统打开 / 所在文件夹 / MinerU（进行中态文案）
      expect(section).toContain("label: '本文件'")
      expect(section).toContain("label: '设为讲义底稿'")
      expect(section).toContain("label: '系统打开'")
      expect(section).toContain("label: '所在文件夹'")
      expect(section).toContain("'增强解析中…'")
      // —分隔线— 危险项在菜单底部红区：从本课移除（既有二次确认弹窗不动）
      expect(section).toContain("kind: 'separator', key: 'danger-sep'")
      expect(section).toContain("label: '从本课移除'")
      expect(section).toContain('danger: true')
      expect(section).toContain("title: '从本课移除资料？'")
      expect(section).toContain('destructive: true')
    })

    it('degrades for read-only lessons and keeps the no-md guide primary action', () => {
      const section = source('../src/renderer/lesson-files-section.tsx')

      // 无 md 新课次：AI 新建备课 / 继续上次备课 主键引导（沿用现有判定）
      expect(section).toContain("{draft === null ? 'AI 新建备课' : '继续上次备课'}")
      expect(section).toContain('本课还没有 Markdown 课件，可先导入 md 讲义或用 AI 生成第一版课件。')
      // 只读课次（已结束）：无修改/编辑/移除，仅 ⋯（系统打开/所在文件夹）
      const readOnlyMenu = section.slice(section.indexOf('{readOnly && ('), section.indexOf('</header>'))
      expect(readOnlyMenu).toContain('AppMenuButton')
      expect(readOnlyMenu).not.toContain('✦ 修改这份')
      const menuEntriesStart = section.indexOf('const menuEntries')
      const menuEntries = section.slice(menuEntriesStart, section.indexOf('if (lesson === null) {', menuEntriesStart))
      expect(menuEntries).toContain('if (!readOnly) {')
      expect(menuEntries).toContain("label: '从本课移除'")
      expect(menuEntries).not.toContain('mineruRunning || busy,\n        })\n      }\n    }')
    })
  })

  describe('阅读器头部退役（lesson-material-reader）', () => {
    it('drops the second header and keeps body/tree/figures/edit semantics intact', () => {
      const reader = source('../src/renderer/lesson-material-reader.tsx')
      const styles = source('../src/renderer/styles.css')

      // 头部操作行退役；正文区/树分组/题图/编辑态保留
      expect(reader).not.toContain('material-reader-document-header')
      expect(reader).not.toContain('material-reader-actions')
      expect(reader).not.toContain('可读资料')
      expect(reader).toContain('material-reader-tree')
      expect(reader).toContain('LessonMaterialTree')
      expect(reader).toContain('grouped')
      expect(reader).toContain('ManagedMarkdownImage')
      // 编辑态受控（editing/onToggleEditing 由工具行持有）
      expect(reader).toContain('readonly editing?: boolean')
      expect(reader).toContain('onToggleEditing?.()')
      // unsupported 态的「用系统应用打开」保留
      expect(reader).toContain('用系统应用打开')
      // 旧头样式退役
      expect(styles).not.toContain('.material-reader-document-header')
      expect(styles).not.toContain('.material-reader-actions')
    })

    it('keeps V1.8.1 grouping, source badges and current badge untouched in the tree', () => {
      const reader = source('../src/renderer/lesson-material-reader.tsx')

      expect(reader).toContain('splitLessonFilesByRole')
      expect(reader).toContain('material-role-group')
      expect(reader).toContain('isCurrentLecture')
      expect(reader).toContain('sourceLabel={lessonFileSourceLabel(node.file)}')
      expect(reader).toContain('isSelectableLessonPrepFile')
    })
  })

  describe('零回归护栏（通道与语义不变）', () => {
    it('keeps all IPC channels and D29 write-version semantics unchanged', () => {
      const section = source('../src/renderer/lesson-files-section.tsx')

      // 提讲义（files:set-lesson-role）、移除（软删除）、刷新、沉浸、修改跳转 intent 沿用
      expect(section).toContain('files.setLessonFileRole({ fileId })')
      expect(section).toContain('files.softDeleteFile({ fileId })')
      expect(section).toContain('void reload()')
      expect(section).toContain("{ mode: 'single', targetFileId: selectedFile.id }")
      expect(section).toContain("{ mode: 'lesson' }")
      expect(section).toContain('handleManualEditSaved')
    })

    it('keeps the history block and manual-edit notes below the reader', () => {
      const section = source('../src/renderer/lesson-files-section.tsx')

      expect(section).toContain('lesson-history-block')
      expect(section).toContain('历史版本（')
      expect(section).toContain('lesson-manual-edit-notes')
      expect(section).toContain('manual_edit')
    })
  })
})
