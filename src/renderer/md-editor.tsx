import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ManagedFileRecord } from '../shared/file-contracts'
import {
  expansionCaretOffset,
  filterSlashItems,
  inMathMode,
  isSlashLineStart,
  matchFractionAtom,
  matchMathSnippet,
  MATH_SNIPPETS,
  fractionReplacement,
  nextSlotOffset,
  resolveSlashInsert,
  SLASH_CURSOR,
} from './math-input'
import { MarkdownDocument } from './lesson-material-reader'
import { toErrorMessage } from './ui-utils'

/** D28/D29（V17-C）+ D36（V1.7.3）：零新依赖 md 编辑器——受控 textarea + 分屏 KaTeX 预览 + 数学模式公式引擎。 */
export default function MdEditor({
  file,
  files,
  onSaved,
  onCancel,
}: {
  readonly file: ManagedFileRecord
  readonly files: readonly ManagedFileRecord[]
  readonly onSaved: (result: { readonly file: ManagedFileRecord; readonly version: number }) => void
  readonly onCancel: () => void
}): React.JSX.Element {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draftRecovered, setDraftRecovered] = useState(false)
  const [recoverPrompt, setRecoverPrompt] = useState(false)
  const [mathMode, setMathMode] = useState(false)
  const [slashMenu, setSlashMenu] = useState<{ readonly query: string; readonly activeIndex: number } | null>(null)
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  // D37（V1.7.3）：三视图（edit/split/preview）与可拖分栏，按文件记忆（localStorage，非法值回退默认）。
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split')
  const [splitRatio, setSplitRatio] = useState(0.5)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewScrollArmed = useRef(false)
  const draftKey = `md-editor-draft:${file.id}`
  const viewKey = `md-editor-view:${file.id}`
  const splitKey = `md-editor-split:${file.id}`
  // 撤销/重做：快照栈（含光标），textarea 原生输入外的工具栏插入走此栈
  const undoStack = useRef<readonly string[]>([])
  const redoStack = useRef<readonly string[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void window.teacherWorkbench.files.readText({ fileId: file.id })
      .then((result) => {
        if (cancelled) return
        const hot = readHotDraft(draftKey)
        if (hot !== null) {
          setBody(result.content)
          window.sessionStorage.setItem(`${draftKey}:hot`, hot)
          setRecoverPrompt(true)
        } else {
          setBody(result.content)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(toErrorMessage(loadError, '正文读取失败，请稍后重试。'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [draftKey, file.id])

  // 热保存：250ms 防抖写 localStorage，失败静默（D28 基准）
  useEffect(() => {
    if (loading || recoverPrompt) return
    const timer = window.setTimeout(() => {
      try {
        if (body.trim() !== '') window.localStorage.setItem(draftKey, body)
        else window.localStorage.removeItem(draftKey)
      } catch {
        // 写入失败静默：热保存只是保险，不阻塞编辑
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [body, draftKey, loading, recoverPrompt])

  function recoverHotDraft(): void {
    const hot = window.sessionStorage.getItem(`${draftKey}:hot`)
    window.sessionStorage.removeItem(`${draftKey}:hot`)
    setBody(hot ?? body)
    setRecoverPrompt(false)
    setDraftRecovered(true)
  }

  function discardHotDraft(): void {
    window.sessionStorage.removeItem(`${draftKey}:hot`)
    try {
      window.localStorage.removeItem(draftKey)
    } catch {
      // 静默
    }
    setRecoverPrompt(false)
  }

  const pushUndo = useCallback((snapshot: string): void => {
    undoStack.current = [...undoStack.current.slice(-99), snapshot]
    redoStack.current = []
  }, [])

  /** D37：按文件恢复三视图与分栏比例（非法/缺失回退默认 split / 0.5）。 */
  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem(viewKey)
      if (savedView === 'edit' || savedView === 'preview') setViewMode(savedView)
      else setViewMode('split')
      const savedRatio = Number(window.localStorage.getItem(splitKey))
      setSplitRatio(Number.isFinite(savedRatio) && savedRatio >= 0.25 && savedRatio <= 0.8 ? savedRatio : 0.5)
    } catch {
      setViewMode('split')
      setSplitRatio(0.5)
    }
  }, [splitKey, viewKey])

  /** D37：行比例单向同步滚动——编辑侧滚动带动预览；预览侧滚动后 800ms 内忽略编辑侧同步（防抢滚动抖动）。 */
  function syncPreviewScroll(): void {
    const textarea = textareaRef.current
    const preview = previewRef.current
    if (textarea === null || preview === null || viewMode !== 'split' || previewScrollArmed.current) return
    const editable = textarea.scrollHeight - textarea.clientHeight
    const scrollable = preview.scrollHeight - preview.clientHeight
    if (editable <= 0 || scrollable <= 0) return
    preview.scrollTop = (textarea.scrollTop / editable) * scrollable
  }

  function armPreviewScrollGuard(): void {
    previewScrollArmed.current = true
    window.setTimeout(() => { previewScrollArmed.current = false }, 800)
  }

  /** D37：拖动分隔条——pointer 事件，比例钳制 0.25–0.80，拖动期间禁 textarea 捕获避免选中文本。 */
  function startSplitDrag(event: React.PointerEvent<HTMLDivElement>): void {
    if (viewMode !== 'split') return
    const container = event.currentTarget.parentElement
    if (container === null) return
    event.preventDefault()
    const textarea = textareaRef.current
    const wasDisabled = textarea?.disabled ?? false
    if (textarea !== null) textarea.disabled = true
    const move = (moveEvent: PointerEvent): void => {
      const rect = container.getBoundingClientRect()
      const ratio = (moveEvent.clientX - rect.left) / rect.width
      setSplitRatio(Math.min(0.8, Math.max(0.25, ratio)))
    }
    const finish = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      if (textarea !== null) textarea.disabled = wasDisabled
      setSplitRatio((ratio) => {
        commitSplitRatio(ratio)
        return ratio
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
  }

  function selectViewMode(mode: 'edit' | 'split' | 'preview'): void {
    setViewMode(mode)
    try {
      window.localStorage.setItem(viewKey, mode)
    } catch {
      // 记忆失败静默：仅本会话生效
    }
  }

  function commitSplitRatio(ratio: number): void {
    try {
      window.localStorage.setItem(splitKey, String(ratio))
    } catch {
      // 静默
    }
  }

  function undo(): void {
    const stack = undoStack.current
    const previous = stack[stack.length - 1]
    if (previous === undefined || textareaRef.current === null) return
    redoStack.current = [...redoStack.current, textareaRef.current.value]
    undoStack.current = stack.slice(0, -1)
    setBody(previous)
  }

  function redo(): void {
    const stack = redoStack.current
    const next = stack[stack.length - 1]
    if (next === undefined || textareaRef.current === null) return
    undoStack.current = [...undoStack.current, textareaRef.current.value]
    redoStack.current = stack.slice(0, -1)
    setBody(next)
  }

  /** D36：光标位置变化 → 推导数学模式（$…$ / $$…$$ 内亮符号条）+ 斜杠菜单跟随光标行查询。 */
  const syncMathMode = useCallback((): void => {
    const textarea = textareaRef.current
    if (textarea === null) return
    setMathMode(inMathMode(textarea.value.slice(0, textarea.selectionStart)))
    setSlashMenu((menu) => {
      if (menu === null) return null
      const pos = textarea.selectionStart
      const lineStart = Math.max(textarea.value.lastIndexOf('\n', pos - 1) + 1, 0)
      const seg = textarea.value.slice(lineStart, pos)
      const slashIndex = seg.lastIndexOf('/')
      if (slashIndex === -1) return null
      const query = seg.slice(slashIndex + 1)
      if (query.includes('\n') || /\s{2,}/u.test(query) || query.length > 12) return null
      return { query, activeIndex: 0 }
    })
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea === null) return
    const onSelectionChange = (): void => {
      if (document.activeElement === textarea) syncMathMode()
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [syncMathMode])

  /**
   * D36：光标处替换展开（缩写/自动分式共用）——删 before 个字符、插 replacement、
   * undo 入栈、光标按 expansionCaretOffset 落首个空 {} 槽位。
   */
  function replaceBefore(before: number, replacement: string): void {
    const textarea = textareaRef.current
    if (textarea === null) return
    pushUndo(textarea.value)
    const start = textarea.selectionStart
    const next = `${textarea.value.slice(0, start - before)}${replacement}${textarea.value.slice(textarea.selectionEnd)}`
    setBody(next)
    requestAnimationFrame(() => {
      const caret = start - before + expansionCaretOffset(replacement)
      textarea.focus()
      textarea.setSelectionRange(caret, caret)
    })
  }

  /** D36：斜杠命令插入——从 `/` 起到光标整段替换为模板文本，光标落占位符处（其后空 {} 优先）。 */
  function insertSlashItem(template: string): void {
    const textarea = textareaRef.current
    if (textarea === null) return
    pushUndo(textarea.value)
    const pos = textarea.selectionStart
    const lineStart = Math.max(textarea.value.lastIndexOf('\n', pos - 1) + 1, 0)
    const slashIndex = textarea.value.lastIndexOf('/', pos - 1)
    const from = slashIndex >= lineStart ? slashIndex : lineStart
    const { text, caret } = resolveSlashInsert(template)
    const next = `${textarea.value.slice(0, from)}${text}${textarea.value.slice(textarea.selectionEnd)}`
    setBody(next)
    setSlashMenu(null)
    requestAnimationFrame(() => {
      const target = from + caret
      textarea.focus()
      textarea.setSelectionRange(target, target)
    })
  }

  /** D36：textarea keydown——数学模式内空格展开缩写、`/` 自动分式、Tab 槽位跳转；空行 `/`/`、` 唤出斜杠菜单；Ctrl+M 公式快捷键。输入法组合期全不拦截。 */
  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.nativeEvent.isComposing) return
    const textarea = textareaRef.current
    if (textarea === null) return
    const before = textarea.value.slice(0, textarea.selectionStart)

    // 斜杠菜单导航：菜单打开时接管 ↑↓/Enter/Esc，且空格不被缩写引擎拦截（菜单优先）
    if (slashMenu !== null) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const count = filterSlashItems(slashMenu.query).length
        setSlashMenu((menu) => menu === null ? menu : {
          ...menu,
          activeIndex: event.key === 'ArrowDown'
            ? (menu.activeIndex + 1) % count
            : (menu.activeIndex - 1 + count) % count,
        })
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const items = filterSlashItems(slashMenu.query)
        const item = items[slashMenu.activeIndex] ?? items[0]
        if (item !== undefined) insertSlashItem(item.insert)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashMenu(null)
        return
      }
    }

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'm') {
      event.preventDefault()
      insertTemplate('$$\n', '\n$$', '')
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
      event.preventDefault()
      insertTemplate('$', '$', '')
      return
    }

    if (event.key === ' ' && textarea.selectionStart === textarea.selectionEnd) {
      if (!inMathMode(before)) return
      const snippet = matchMathSnippet(before)
      if (snippet === null) return
      event.preventDefault()
      replaceBefore(snippet.trigger.length, snippet.replacement)
      return
    }
    if (event.key === '/' && textarea.selectionStart === textarea.selectionEnd) {
      if (inMathMode(before)) {
        const atom = matchFractionAtom(before)
        if (atom !== null) {
          event.preventDefault()
          replaceBefore(atom.cut, fractionReplacement(atom.atom))
        }
        return
      }
      if (isSlashLineStart(before) && slashMenu === null) {
        setSlashMenu({ query: '', activeIndex: 0 })
      }
      return
    }
    if (event.key === '、' && textarea.selectionStart === textarea.selectionEnd) {
      // 中文顿号：空行触发时消费并改写为 `/` 唤出菜单；否则正常输入
      if (isSlashLineStart(before) && slashMenu === null) {
        event.preventDefault()
        const next = `${textarea.value.slice(0, textarea.selectionStart)}/${textarea.value.slice(textarea.selectionEnd)}`
        setBody(next)
        requestAnimationFrame(() => {
          const caret = textarea.selectionStart + 1
          textarea.focus()
          textarea.setSelectionRange(caret, caret)
        })
        setSlashMenu({ query: '', activeIndex: 0 })
      }
      return
    }
    if (event.key === 'Tab' && textarea.selectionStart === textarea.selectionEnd) {
      const offset = nextSlotOffset(textarea.value.slice(textarea.selectionStart))
      if (offset === 0) return
      event.preventDefault()
      const caret = textarea.selectionStart + offset
      textarea.setSelectionRange(caret, caret)
    }
  }

  /** 在光标处插入模板；选中文本存在时包裹（行内语法）或替换为空模板。 */
  function insertTemplate(before: string, after = '', placeholder = ''): void {
    const textarea = textareaRef.current
    if (textarea === null) return
    pushUndo(textarea.value)
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = textarea.value.slice(start, end)
    const inner = selected !== '' ? selected : placeholder
    const next = `${textarea.value.slice(0, start)}${before}${inner}${after}${textarea.value.slice(end)}`
    setBody(next)
    requestAnimationFrame(() => {
      const caret = start + before.length + inner.length
      textarea.focus()
      textarea.setSelectionRange(
        selected !== '' ? caret : start + before.length,
        selected !== '' ? caret : start + before.length + placeholder.length,
      )
    })
  }

  function insertBlockLines(prefix: string): void {
    const textarea = textareaRef.current
    if (textarea === null) return
    pushUndo(textarea.value)
    const start = textarea.selectionStart
    const lineStart = textarea.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const next = `${textarea.value.slice(0, lineStart)}${prefix}${textarea.value.slice(lineStart)}`
    setBody(next)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length)
    })
  }

  async function saveAsNewVersion(): Promise<void> {
    if (saving || body.trim() === '') return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await window.teacherWorkbench.files.writeVersion({
        fileId: file.id,
        bodyMd: body,
      })
      try {
        window.localStorage.removeItem(draftKey)
        window.sessionStorage.removeItem(`${draftKey}:hot`)
      } catch {
        // 静默
      }
      onSaved(result)
    } catch (saveError) {
      setError(toErrorMessage(saveError, '保存失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  // D37（V1.7.3）：预览渲染 120ms 防抖——连续输入时不逐字全量重渲（热保存 250ms 与保存路径不变，保存始终用 body）。
  const [previewBody, setPreviewBody] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewBody(body), 120)
    return () => window.clearTimeout(timer)
  }, [body])

  const lessonImages = useMemo(
    () => files.filter((candidate) => candidate.mimeType.startsWith('image/')),
    [files],
  )
  const canSave = !loading && !saving && !recoverPrompt && body.trim() !== ''
  // 预览源：防抖值优先；防抖尚未首刷时直接用 body（首次载入不闪"空文档"占位）
  const previewSource = previewBody !== '' ? previewBody : body !== '' ? body : '（空文档）'

  return (
    <div className="md-editor" aria-label={`编辑 ${file.originalName}`}>
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
      {notice !== '' && <div className="inline-notice" role="status">{notice}</div>}
      {recoverPrompt && (
        <div className="md-editor-recover inline-notice" role="status">
          检测到上次未保存的编辑草稿。{draftRecovered ? '已恢复。' : '恢复吗？'}
          {!draftRecovered && (
            <>
              <button className="secondary-button" type="button" onClick={recoverHotDraft}>恢复草稿</button>
              <button className="secondary-button" type="button" onClick={discardHotDraft}>丢弃</button>
            </>
          )}
        </div>
      )}
      <div className="md-editor-toolbar" role="toolbar" aria-label="Markdown 编辑工具栏">
        <button type="button" title="加粗" onClick={() => insertTemplate('**', '**', '加粗文本')}>B</button>
        <button type="button" title="斜体" onClick={() => insertTemplate('*', '*', '斜体文本')}><i>i</i></button>
        <select
          aria-label="标题层级（字号）"
          defaultValue=""
          onChange={(event) => {
            const value = event.currentTarget.value
            if (value !== '') insertBlockLines(value)
            event.currentTarget.value = ''
          }}
        >
          <option value="" disabled>标题字号</option>
          <option value="# ">H1 大标题</option>
          <option value="## ">H2 中标题</option>
          <option value="### ">H3 小标题</option>
        </select>
        <button type="button" title="下标 x₂" onClick={() => insertTemplate('<sub>', '</sub>', '下标')}>x₂</button>
        <button type="button" title="上标 x²" onClick={() => insertTemplate('<sup>', '</sup>', '上标')}>x²</button>
        <button type="button" title="无序列表" onClick={() => insertBlockLines('- ')}>• 列表</button>
        <button type="button" title="有序列表" onClick={() => insertBlockLines('1. ')}>1. 列表</button>
        <button type="button" title="引用" onClick={() => insertBlockLines('> ')}>引用</button>
        <button type="button" title="表格模板" onClick={() => insertTemplate('\n| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n', '', '')}>表格</button>
        <button type="button" title="分隔线" onClick={() => insertTemplate('\n---\n', '', '')}>—</button>
        <span className="md-editor-toolbar-sep" aria-hidden="true" />
        <button type="button" title="行内公式 $…$" onClick={() => insertTemplate('$', '$', 'a^2+b^2=c^2')}>$x$</button>
        <button type="button" title="块级公式 $$…$$" onClick={() => insertTemplate('$$\n', '\n$$', '公式')}>$$∑$$</button>
        <button
          type="button"
          title="插入本课图片引用"
          aria-expanded={imagePickerOpen}
          onClick={() => setImagePickerOpen((open) => !open)}
        >▦ 插图</button>
        <span className="md-editor-toolbar-sep" aria-hidden="true" />
        <button type="button" title="撤销" onClick={undo}>↶</button>
        <button type="button" title="重做" onClick={redo}>↷</button>
      </div>
      {mathMode && (
        <div className="md-editor-math-bar" role="group" aria-label="数学模式符号条">
          <span className="md-editor-math-label">ƒx 数学模式</span>
          {MATH_SNIPPETS.map((snippet) => (
            <button
              key={snippet.trigger}
              type="button"
              className="md-editor-math-chip"
              title={`${snippet.label}（输入 ${snippet.trigger} + 空格自动展开）`}
              onClick={() => replaceBefore(0, snippet.replacement)}
            >
              {snippet.label}<span className="md-editor-math-hint">{snippet.trigger}</span>
            </button>
          ))}
          <span className="md-editor-math-tip">缩写+空格 自动展开 · x 紧跟 / 自动分式 · Tab 跳槽位</span>
        </div>
      )}
      {slashMenu !== null && (
        <div className="md-editor-slash-menu" role="listbox" aria-label="斜杠命令菜单">
          <div className="md-editor-slash-line">
            <span>过滤：</span>
            <b>/{slashMenu.query}</b>
            <span className="md-editor-slash-cursor" aria-hidden="true" />
            <span className="md-editor-slash-hint">↑↓ 选择 · Enter 插入 · Esc 关闭</span>
          </div>
          <ul>
            {filterSlashItems(slashMenu.query).map((item, index) => (
              <li
                key={item.name}
                role="option"
                aria-selected={index === slashMenu.activeIndex}
                className={index === slashMenu.activeIndex ? 'md-editor-slash-item is-active' : 'md-editor-slash-item'}
                onMouseDown={(event) => { event.preventDefault(); insertSlashItem(item.insert) }}
              >
                <span className="md-editor-slash-name">{item.name}</span>
                <span className="md-editor-slash-py">{item.keywords[0]}</span>
                <span className="md-editor-slash-preview">插入 {item.insert.split(SLASH_CURSOR).join('␣').replace(/\n/gu, ' ⏎ ')}</span>
              </li>
            ))}
            {filterSlashItems(slashMenu.query).length === 0 && (
              <li className="md-editor-slash-empty">无匹配命令（继续输入或 Esc 关闭）</li>
            )}
          </ul>
        </div>
      )}
      {imagePickerOpen && (
        <div className="md-editor-palette" role="group" aria-label="本课图片">
          {lessonImages.length === 0 && <span className="md-editor-palette-empty">本课还没有图片资料；先从素材库或外部资料复制图片到本课。</span>}
          {lessonImages.map((image) => (
            <button
              key={image.id}
              type="button"
              className="md-editor-palette-item"
              title={`插入 ![${displayBaseName(image.originalName)}](${image.originalName})`}
              onClick={() => {
                insertTemplate(`![${displayBaseName(image.originalName)}](${image.originalName})`, '', '')
                setImagePickerOpen(false)
              }}
            >
              {image.originalName}
            </button>
          ))}
        </div>
      )}
      <div className="md-editor-view-bar" role="group" aria-label="编辑器视图">
        {([
          { mode: 'edit' as const, title: '纯编辑（单栏源码）', text: '✎ 编辑' },
          { mode: 'split' as const, title: '分屏（源码 + 实时预览，可拖分隔条）', text: '◫ 分屏' },
          { mode: 'preview' as const, title: '纯预览（只读渲染）', text: '👁 预览' },
        ]).map((option) => (
          <button
            key={option.mode}
            type="button"
            title={option.title}
            aria-pressed={viewMode === option.mode}
            className={viewMode === option.mode ? 'md-editor-view-button is-active' : 'md-editor-view-button'}
            onClick={() => selectViewMode(option.mode)}
          >
            {option.text}
          </button>
        ))}
      </div>
      <div
        className={viewMode === 'split' ? 'md-editor-split is-split' : 'md-editor-split'}
        style={viewMode === 'split' ? { gridTemplateColumns: `${(splitRatio * 100).toFixed(2)}fr ${(100 - splitRatio * 100).toFixed(2)}fr` } : undefined}
      >
        {viewMode !== 'preview' && (
          <textarea
            ref={textareaRef}
            className="md-editor-textarea"
            value={body}
            disabled={loading || saving}
            spellCheck={false}
            aria-label={`${file.originalName} 正文编辑`}
            onChange={(event) => {
              setBody(event.currentTarget.value)
              syncMathMode()
            }}
            onKeyDown={handleEditorKeyDown}
            onClick={syncMathMode}
            onSelect={syncMathMode}
            onBlur={() => { window.setTimeout(() => setSlashMenu(null), 120) }}
            onScroll={syncPreviewScroll}
          />
        )}
        {viewMode === 'split' && (
          <div
            className="md-editor-split-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动调整分栏比例"
            title="拖动调整分栏比例"
            onPointerDown={startSplitDrag}
          />
        )}
        {viewMode !== 'edit' && (
          <div
            ref={previewRef}
            className="md-editor-preview"
            aria-label="实时预览（KaTeX 渲染）"
            onScroll={armPreviewScrollGuard}
          >
            <MarkdownDocument body={previewSource} files={files} />
          </div>
        )}
      </div>
      <footer className="md-editor-actions">
        <span className="md-editor-hint">保存为**新版本**：旧版保留在历史版本，原件永不被改写。公式内输入缩写（frac、sum、int…）+ 空格自动展开；x 紧跟 / 自动分式；Tab 跳槽位；空行输入 / 唤出模板菜单。</span>
        <div>
          <button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>取消</button>
          <button
            className="primary-button"
            type="button"
            disabled={!canSave}
            title={body.trim() === '' ? '正文为空' : '保存为新版本（版本链出“ · 第 N+1 版.md”，外部 md 出“原名（编辑版）.md”）'}
            onClick={() => { void saveAsNewVersion() }}
          >
            {saving ? '正在保存…' : '保存为新版本'}
          </button>
        </div>
      </footer>
    </div>
  )
}

function readHotDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function displayBaseName(name: string): string {
  return name.replace(/\.[^.]+$/u, '')
}
