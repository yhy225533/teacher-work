import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ManagedFileRecord } from '../shared/file-contracts'
import {
  expansionCaretOffset,
  inMathMode,
  matchFractionAtom,
  matchMathSnippet,
  MATH_SNIPPETS,
  fractionReplacement,
  nextSlotOffset,
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
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftKey = `md-editor-draft:${file.id}`
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

  /** D36：光标位置变化 → 推导数学模式（$…$ / $$…$$ 内亮符号条）。 */
  const syncMathMode = useCallback((): void => {
    const textarea = textareaRef.current
    if (textarea === null) return
    setMathMode(inMathMode(textarea.value.slice(0, textarea.selectionStart)))
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

  /** D36：textarea keydown——数学模式内空格展开缩写、`/` 自动分式、Tab 槽位跳转。输入法组合期全不拦截。 */
  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.nativeEvent.isComposing) return
    const textarea = textareaRef.current
    if (textarea === null) return
    const before = textarea.value.slice(0, textarea.selectionStart)
    if (event.key === ' ' && textarea.selectionStart === textarea.selectionEnd) {
      if (!inMathMode(before)) return
      const snippet = matchMathSnippet(before)
      if (snippet === null) return
      event.preventDefault()
      replaceBefore(snippet.trigger.length, snippet.replacement)
      return
    }
    if (event.key === '/' && textarea.selectionStart === textarea.selectionEnd) {
      if (!inMathMode(before)) return
      const atom = matchFractionAtom(before)
      if (atom === null) return
      event.preventDefault()
      replaceBefore(atom.cut, fractionReplacement(atom.atom))
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

  const lessonImages = useMemo(
    () => files.filter((candidate) => candidate.mimeType.startsWith('image/')),
    [files],
  )
  const canSave = !loading && !saving && !recoverPrompt && body.trim() !== ''

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
      <div className="md-editor-split">
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
        />
        <div className="md-editor-preview" aria-label="实时预览（KaTeX 渲染）">
          <MarkdownDocument body={body === '' ? '（空文档）' : body} files={files} />
        </div>
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
