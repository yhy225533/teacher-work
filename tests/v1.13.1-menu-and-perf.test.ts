import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(join(__dirname, '..', relativePath), 'utf8')
}

/**
 * V1.13.1 修复钉测（走查反馈：改组菜单点不中 + ⋯ 被 ✕ 遮挡 + 管理态卡顿）。
 * 菜单交互的真实鼠标行为无法在 node 测试环境复现（CDP 探针 tmp/v113-smoke/probe-menu.mjs
 * 负责端到端实证），此处钉死源码级不变量防回退。
 */
describe('V1.13.1 菜单容器关闭 + 遮挡避让 + 管理态改组 + 正文 memo', () => {
  it('AppMenuButton outside-close uses the whole container (trigger + menu list), not the trigger alone', () => {
    const menu = source('src/renderer/app-menu.tsx')
    // 容器 ref 覆盖触发按钮与菜单列表
    expect(menu).toContain('const containerRef = useRef<HTMLSpanElement>(null)')
    expect(menu).toContain('<span className="app-menu" ref={containerRef}>')
    expect(menu).toContain('containerRef.current.contains(event.target)')
    // 旧实现（只认触发按钮）禁入
    expect(menu).not.toContain('buttonRef.current.contains')
  })

  it('menu list uses measured fixed positioning with upward flip (escapes scroll-container clipping)', () => {
    const menu = source('src/renderer/app-menu.tsx')
    expect(menu).toContain("style: React.CSSProperties = { position: 'fixed' }")
    // 向上/向下翻转时都必须显式压掉基础类的 top: calc(100% + 6px)
    expect(menu).toContain("style.top = 'auto'")
    expect(menu).toContain("style.bottom = 'auto'")
    // 右对齐时压掉基础类 left: 0
    expect(menu).toContain("style.left = 'auto'")
    expect(menu).toContain('role="menu" style={listStyle ?? undefined}')
  })

  it('tree rows shift the hover remove ✕ clear of the group menu trigger', () => {
    const styles = source('src/renderer/styles.css')
    expect(styles).toContain('.material-reader-tree-row:has(.tree-group-menu-btn) .material-reader-tree-remove { right: 30px; }')
  })

  it('regroup menu stays available in manage mode', () => {
    const reader = source('src/renderer/lesson-material-reader.tsx')
    expect(reader).toContain('onSetFileGroup={onSetFileGroup !== undefined && !isLessonLectureFile(node.file)')
    // 旧条件（管理态隐藏菜单）禁入
    expect(reader).not.toContain('!manageMode && !isLessonLectureFile')
  })

  it('MarkdownDocument is memoized so manage toggles skip the expensive document re-render', () => {
    const reader = source('src/renderer/lesson-material-reader.tsx')
    expect(reader).toContain('export const MarkdownDocument = memo(function MarkdownDocument')
    expect(reader).toContain('useMemo(() => parseBlocks(body), [body])')
  })
})
