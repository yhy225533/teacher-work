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
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent): void => {
      if (buttonRef.current !== null && event.target instanceof Node && buttonRef.current.contains(event.target)) return
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
    <span className="app-menu">
      <button
        ref={buttonRef}
        className={buttonClassName}
        type="button"
        disabled={disabled}
        title={title}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => { setOpen((current) => !current) }}
      >
        {label}
      </button>
      {open && (
        <div className={`app-menu-list${align === 'right' ? ' is-right' : ''}`} role="menu">
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
