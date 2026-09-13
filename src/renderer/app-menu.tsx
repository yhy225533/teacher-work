import { useEffect, useRef, useState } from 'react'

/**
 * V19-B（D57）：共用 ⋯ 收纳菜单——分组小标题 / 菜单项 / 危险项底部红区 + 分隔线；
 * 点击外部、Esc、窗口失焦/滚动关闭（素材库右键菜单交互先例）。课件区（V19-B）与课程页（V19-C）共用。
 */
export interface AppMenuItem {
  readonly kind: 'item'
  readonly key: string
  readonly label: string
  readonly onSelect: () => void
  readonly disabled?: boolean
  readonly title?: string
  readonly danger?: boolean
}

export interface AppMenuSeparator {
  readonly kind: 'separator'
  readonly key: string
}

export interface AppMenuGroupLabel {
  readonly kind: 'group'
  readonly key: string
  readonly label: string
}

export type AppMenuEntry = AppMenuItem | AppMenuSeparator | AppMenuGroupLabel

export function AppMenuButton({ label, entries, buttonClassName = 'secondary-button app-menu-btn', align = 'left', disabled, title }: {
  /** 触发按钮显示文案（如「⋯」）。 */
  readonly label: string
  readonly entries: readonly AppMenuEntry[]
  /** 触发按钮 class（默认 secondary-button 样式）。 */
  readonly buttonClassName?: string
  /** 菜单对齐方向：left = 左对齐按钮下方，right = 右对齐。 */
  readonly align?: 'left' | 'right'
  readonly disabled?: boolean
  readonly title?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  // V1.13.1：外点关闭以"触发按钮 + 菜单列表"整个容器为界——旧实现只认触发按钮，
  // 真实鼠标按下菜单项（pointerdown）会先把菜单关掉，click 落空、选择静默失效（探针实锤）。
  const containerRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // V1.13.1：列表改 fixed 定位——absolute 列表会被滚动容器（如 .material-reader-tree 的
  // overflow-y: auto，窄窗口下 max-height 210px）裁剪，底部行的菜单不可见不可点。
  // 打开时按触发按钮实测坐标计算；下方剩余空间不足时向上翻。
  const [listStyle, setListStyle] = useState<React.CSSProperties | null>(null)

  function toggleOpen(): void {
    if (open) { setOpen(false); return }
    const trigger = triggerRef.current
      if (trigger !== null) {
        const rect = trigger.getBoundingClientRect()
        const margin = 6
        const estimateHeight = 240
        const style: React.CSSProperties = { position: 'fixed' }
        // 基础类 .app-menu-list 带 top: calc(100% + 6px)/left: 0——方向翻转时须用 auto 显式压掉，
        // 否则 top/bottom 双约束把列表顶出视口（探针实测 top=787 > innerHeight=781）。
        if (rect.bottom + estimateHeight > window.innerHeight - 8) {
          style.top = 'auto'
          style.bottom = window.innerHeight - rect.top + margin
        } else {
          style.top = rect.bottom + margin
          style.bottom = 'auto'
        }
      if (align === 'right') {
        // 基础类 .app-menu-list 带 left: 0，右对齐时须显式压掉，避免 left/right 双约束撑宽
        style.right = window.innerWidth - rect.right
        style.left = 'auto'
      } else {
        style.left = rect.left
      }
      setListStyle(style)
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent): void => {
      if (containerRef.current !== null && event.target instanceof Node && containerRef.current.contains(event.target)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    const closePlain = (): void => { setOpen(false) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', closePlain)
    window.addEventListener('resize', closePlain)
    document.addEventListener('scroll', closePlain, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('blur', closePlain)
      window.removeEventListener('resize', closePlain)
      document.removeEventListener('scroll', closePlain, true)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <span className="app-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        className={buttonClassName}
        type="button"
        disabled={disabled}
        title={title}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggleOpen}
      >
        {label}
      </button>
      {open && (
        <div className={`app-menu-list${align === 'right' ? ' is-right' : ''}`} role="menu" style={listStyle ?? undefined}>
          {entries.map((entry) => {
            if (entry.kind === 'separator') return <hr key={entry.key} className="app-menu-separator" />
            if (entry.kind === 'group') return <p key={entry.key} className="app-menu-group">{entry.label}</p>
            return (
              <button
                key={entry.key}
                type="button"
                role="menuitem"
                className={entry.danger === true ? 'is-danger' : undefined}
                disabled={entry.disabled}
                title={entry.title}
                onClick={() => { setOpen(false); entry.onSelect() }}
              >
                {entry.label}
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}
