import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  expansionCaretOffset,
  filterSlashItems,
  fractionReplacement,
  inMathMode,
  matchFractionAtom,
  matchMathSnippet,
  nextSlotOffset,
  resolveSlashInsert,
  SLASH_CURSOR,
} from '../src/renderer/math-input'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

// V1.7.3（D36）：数学模式引擎——纯函数行为钉测。
describe('math-input 纯函数：数学模式侦测', () => {
  it('detects math mode by odd $ count before the caret ($$ counts as two)', () => {
    expect(inMathMode('已知 $a^2')).toBe(true) // 行内公式内
    expect(inMathMode('已知 $a$ 之后')).toBe(false) // 公式已闭合
    expect(inMathMode('$$\n\\int_1^2')).toBe(true) // 块级公式内（两个 $ 计数 2，再进一层为奇）
    expect(inMathMode('$$\n\\frac{}{}\n$$\n正文')).toBe(false)
    expect(inMathMode('')).toBe(false)
    expect(inMathMode('价格 $5 与 $7 之间')).toBe(false) // 偶数个 $ 均为闭合
  })
})

describe('math-input 纯函数：缩写匹配（最长优先 + 词边界）', () => {
  it('expands the longest matching trigger and puts the caret in the first empty slot', () => {
    const frac = matchMathSnippet('$frac')
    expect(frac).not.toBeNull()
    expect(frac?.trigger).toBe('frac')
    expect(frac?.replacement).toBe('\\frac{}{}')
    expect(expansionCaretOffset(frac!.replacement)).toBe('\\frac{'.length)

    const sqrt = matchMathSnippet('$sqrt')
    expect(sqrt?.replacement).toBe('\\sqrt{}')
    expect(expansionCaretOffset(sqrt!.replacement)).toBe('\\sqrt{'.length)

    const cases = matchMathSnippet('$cases')
    expect(cases?.replacement).toBe('\\begin{cases} {} \\\\ {} \\end{cases}')
    // 已填参数括号不是空槽位：首个空 {} 为第二个方程
    expect(expansionCaretOffset(cases!.replacement)).toBe('\\begin{cases} {'.length)
  })

  it('does not expand a trigger embedded in a longer word (word boundary)', () => {
    expect(matchMathSnippet('$limx')).toBeNull() // lim 后跟字母 → 更长单词
    expect(matchMathSnippet('$ lim')).not.toBeNull() // 空格分隔 → 命中
    expect(matchMathSnippet('$le')).not.toBeNull()
    expect(matchMathSnippet('$angle')).not.toBeNull() // angle 不被 le 抢占（最长优先）
    expect(matchMathSnippet('$x^2')).toBeNull()
    expect(matchMathSnippet('$abc')).toBeNull()
  })

  it('covers fraction auto-expansion with a filled numerator keeping the denominator slot', () => {
    // 自动分式：分子已填 {x}，首个空槽位是分母
    const replacement = fractionReplacement('x')
    expect(replacement).toBe('\\frac{x}{}')
    expect(expansionCaretOffset(replacement)).toBe('\\frac{x}{'.length)
  })
})

describe('math-input 纯函数：自动分式原子判定', () => {
  it('accepts alphanumeric atoms and filled {} groups before the caret', () => {
    expect(matchFractionAtom('$x')).toEqual({ atom: 'x', cut: 1 })
    expect(matchFractionAtom('$2x')).toEqual({ atom: '2x', cut: 2 })
    expect(matchFractionAtom('$\\frac{ab}')).toEqual({ atom: 'ab', cut: 4 })
  })

  it('returns null when no atom precedes the caret (slash stays literal)', () => {
    expect(matchFractionAtom('$+')).toBeNull() // 紧跟运算符
    expect(matchFractionAtom('$')).toBeNull() // 公式开头
    expect(matchFractionAtom('$\\frac{ab}{')).toBeNull() // 分母 { 之后（未闭合组不算原子）
  })
})

describe('math-input 纯函数：Tab 槽位跳转', () => {
  it('jumps into the next empty {} slot, then over }, then out of $', () => {
    expect(nextSlotOffset('{}^{} $')).toBe(1) // 跳进分子
    expect(nextSlotOffset('} + 1$')).toBe(1) // 跳出 }
    expect(nextSlotOffset('^{} + 1$')).toBe(2) // 跳进上标空槽（跳过 ^）
    expect(nextSlotOffset('$ 文本继续')).toBe(1) // 跳出公式收尾 $
    expect(nextSlotOffset('$$\n')).toBe(2) // 跳出块级公式收尾 $$
    expect(nextSlotOffset('x + 1$ 后文')).toBe(6) // 跳到收尾 $ 之后
    expect(nextSlotOffset('abc def')).toBe(0) // 无可跳 → 不劫持 Tab
  })
})

describe('math-input 纯函数：斜杠命令数据（V173-B 前置，随引擎同模块落地）', () => {
  it('filters slash items by pinyin abbreviations, Chinese and English keywords', () => {
    expect(filterSlashItems('gs').map((item) => item.name)).toContain('块级公式 $$…$$')
    expect(filterSlashItems('公').map((item) => item.name)).toContain('块级公式 $$…$$')
    expect(filterSlashItems('jz').map((item) => item.name)).toEqual(['3×3 矩阵'])
    expect(filterSlashItems('matrix').map((item) => item.name)).toEqual(['3×3 矩阵'])
    expect(filterSlashItems('')).toHaveLength(12) // 空查询全量
    expect(filterSlashItems('zzz')).toHaveLength(0)
  })

  it('resolves insert templates: strips the cursor placeholder and prefers an empty slot after it', () => {
    const block = resolveSlashInsert('$$\n' + SLASH_CURSOR + '\n$$')
    expect(block.text).toBe('$$\n\n$$')
    expect(block.caret).toBe(3) // 落在 $$ 换行后的中间行首

    const inline = resolveSlashInsert('$' + SLASH_CURSOR + '$')
    expect(inline.text).toBe('$$')
    expect(inline.caret).toBe(1)

    const plain = resolveSlashInsert('> ')
    expect(plain.text).toBe('> ')
    expect(plain.caret).toBe(2)
  })
})

// V173-A 接线：编辑器源码断言（数学态符号条 + 速查面板退役）。
describe('V173-A md-editor 数学模式接线（源码断言）', () => {
  it('wires the math-mode engine: symbol bar replaces the old palette', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    // 引擎接线：数学模式侦测 + 缩写/分式/槽位在 keydown 消费
    expect(editorSource).toContain('inMathMode')
    expect(editorSource).toContain('matchMathSnippet')
    expect(editorSource).toContain('matchFractionAtom')
    expect(editorSource).toContain('nextSlotOffset')
    expect(editorSource).toContain('expansionCaretOffset')
    expect(editorSource).toContain('isComposing')
    // 数学态符号条（双态工具栏）
    expect(editorSource).toContain('md-editor-math-bar')
    expect(editorSource).toContain('mathMode')
    // 旧速查面板退役
    expect(editorSource).not.toContain('latexPaletteOpen')
    expect(editorSource).not.toContain('LaTeX 公式速查')
  })

  it('moves the snippet table into math-input.ts and keeps the editor dependency-free', () => {
    const mathInputSource = source('../src/renderer/math-input.ts')
    const editorSource = source('../src/renderer/md-editor.tsx')

    // 缩写表落位 math-input.ts，含新增的矩阵/积分/极限/求和等复杂结构模板
    for (const trigger of ["'frac'", "'sqrt'", "'sum'", "'int'", "'lim'", "'mat'", "'cases'"]) {
      expect(mathInputSource).toContain(`trigger: ${trigger}`)
    }
    // 旧 18 项速查中的几何/求和条目并入符号条标签
    for (const label of ['≌', '∽', '因为', '所以']) {
      expect(mathInputSource).toContain(`label: '${label}'`)
    }
    // 编辑器不再自带 snippet 表
    expect(editorSource).not.toContain('export const LATEX_SNIPPETS')
  })
})

// V173-B 接线：斜杠命令菜单与公式快捷键。
describe('V173-B 斜杠命令与快捷键（源码断言）', () => {
  it('opens the slash menu on empty-line / or 、, with full keyboard navigation and blur close', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    expect(editorSource).toContain('isSlashLineStart')
    expect(editorSource).toContain('setSlashMenu({ query: \'\', activeIndex: 0 })')
    // 顿号触发：空行 、 改写为 / 并唤出菜单
    expect(editorSource).toContain("event.key === '、'")
    // 菜单导航：↑↓ 循环、Enter 插入选中项、Esc 关闭；菜单优先于缩写空格拦截
    expect(editorSource).toContain("'ArrowDown'")
    expect(editorSource).toContain("'ArrowUp'")
    expect(editorSource).toContain("'Enter'")
    expect(editorSource).toContain("'Escape'")
    // 失焦关闭（延迟避开点击竞态）
    expect(editorSource).toContain('setSlashMenu(null), 120')
    // 菜单 markup：listbox/option、拼音列、插入预览、空态
    expect(editorSource).toContain('md-editor-slash-menu')
    expect(editorSource).toContain('md-editor-slash-item')
    expect(editorSource).toContain('无匹配命令')
    expect(editorSource).toContain('filterSlashItems(slashMenu.query).map')
  })

  it('adds Ctrl+M block formula and Ctrl+Shift+M inline formula hotkeys sharing insertTemplate', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    expect(editorSource).toContain("event.key.toLowerCase() === 'm'")
    expect(editorSource).toContain(String.raw`insertTemplate('$$\n', '\n$$', '')`)
    expect(editorSource).toContain("insertTemplate('$', '$', '')")
    // 选中包裹：行内公式热键不吞选区（insertTemplate 自带包裹语义）
    expect(editorSource).toContain('event.shiftKey')
  })

  it('keeps the slash insert path on the undo stack with caret at the placeholder', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    expect(editorSource).toContain('function insertSlashItem')
    expect(editorSource).toContain('resolveSlashInsert(template)')
    expect(editorSource).toContain('pushUndo(textarea.value)')
    expect(editorSource).toContain('setSlashMenu(null)')
  })
})

// V173-C 接线：三视图、可拖分栏与同步滚动。
describe('V173-C 三视图与可拖分栏（源码断言）', () => {
  it('renders the view segmented control (edit/split/preview) with per-file memory and split default', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    expect(editorSource).toContain('md-editor-view-bar')
    expect(editorSource).toContain("'edit' | 'split' | 'preview'")
    expect(editorSource).toContain("useState<'edit' | 'split' | 'preview'>('split')")
    expect(editorSource).toContain('md-editor-view:${file.id}')
    // 记忆恢复：非法/缺失回退 split；viewKey 持久化在切换时写入
    expect(editorSource).toContain("savedView === 'edit' || savedView === 'preview'")
    expect(editorSource).toContain('window.localStorage.setItem(viewKey, mode)')
    // 条件渲染：preview 态不渲染 textarea，edit 态不渲染预览
    expect(editorSource).toContain("viewMode !== 'preview' && (")
    expect(editorSource).toContain("viewMode !== 'edit' && (")
  })

  it('drags the splitter with clamped ratio persistence (0.25–0.80) and disables textarea during drag', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    expect(editorSource).toContain('md-editor-split-handle')
    expect(editorSource).toContain('role="separator"')
    expect(editorSource).toContain('Math.min(0.8, Math.max(0.25, ratio))')
    expect(editorSource).toContain('md-editor-split:${file.id}')
    expect(editorSource).toContain('commitSplitRatio(ratio)')
    // 拖动期间禁 textarea 捕获避免选中文本
    expect(editorSource).toContain('textarea.disabled = true')
    expect(editorSource).toContain('textarea.disabled = wasDisabled')
    // split 态比例由内联三列模板接管：左·比例fr / 分隔条 auto / 右·比例fr（V173-fix：三子元素必须三列，
    // 否则分隔条占第二列、预览被挤到第二行变成上下堆叠）
    expect(editorSource).toContain("gridTemplateColumns: `${(splitRatio * 100).toFixed(2)}fr auto ${(100 - splitRatio * 100).toFixed(2)}fr`")
  })

  it('syncs scroll one-way from editor to preview with an 800ms reverse guard', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    expect(editorSource).toContain('syncPreviewScroll')
    expect(editorSource).toContain('preview.scrollTop = (textarea.scrollTop / editable) * scrollable')
    expect(editorSource).toContain('previewScrollArmed')
    expect(editorSource).toContain('armPreviewScrollGuard')
    expect(editorSource).toContain('previewScrollArmed.current = true')
    expect(editorSource).toContain('}, 800)')
    // 预览侧滚动不反向拉动编辑侧
    expect(editorSource).toContain('onScroll={armPreviewScrollGuard}')
    expect(editorSource).toContain('onScroll={syncPreviewScroll}')
  })
})

// V173-D：预览管线——公式 LRU 缓存、错误红色降级、120ms 防抖。
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { MarkdownDocument } from '../src/renderer/lesson-material-reader'

describe('V173-D MathSpan 公式缓存与错误降级', () => {
  it('renders valid formulas through KaTeX and caches by content (re-render does not duplicate)', () => {
    const body = '公式 $a^2+b^2=c^2$ 与 $\frac{1}{2}$。'
    const first = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    const second = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    // 两次渲染产物一致；命中缓存的第二次与第一次字节相同（内容缓存语义）
    expect(first).toContain('class="katex"')
    expect(second).toBe(first)
    // 模块级缓存命中不产生 KaTeX 重复输出差异（错误路径才可见 math-error）
    expect(first).not.toContain('math-error')
  })

  it('degrades broken formulas to the red math-error span with the KaTeX message instead of raw source', () => {
    const body = '坏公式 ' + String.raw`$\frac{$` + ' 继续'
    const markup = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    expect(markup).toContain('math-error')
    expect(markup).toContain('⚠')
    // title 悬停可见原始串，消息本身来自 KaTeX（含 parse error 语义）
    expect(markup).toContain('title="' + String.raw`\frac{` + '"')
    expect(markup).toMatch(/KaTeX parse error|Undefined control sequence|Expected group/u)
    // 不再是整段裸源码回显（旧 throwOnError:false 语义的 .material-math 包裹不再出现于坏公式）
    expect(markup).not.toMatch(/class="material-math"[^>]*>\\frac\{/u)
  })

  it('keeps valid and broken formulas side by side in one document', () => {
    const markup = renderToStaticMarkup(createElement(MarkdownDocument, { body: '好 $x^2$ 坏 ' + String.raw`$\begin{cases}$` + ' 收', files: [] }))
    expect(markup).toContain('class="katex"')
    expect(markup).toContain('math-error')
  })
})

describe('V173-D 预览防抖（源码断言）', () => {
  it('debounces the preview render at 120ms while save and hot-save paths stay on body', () => {
    const editorSource = source('../src/renderer/md-editor.tsx')

    expect(editorSource).toContain('setPreviewBody(body), 120')
    expect(editorSource).toContain('previewSource')
    expect(editorSource).toContain('<MarkdownDocument body={previewSource}')
    // 保存/热保存不走防抖值：writeVersion 与热草稿仍读 body
    expect(editorSource).toContain('bodyMd: body')
    expect(editorSource).toContain('window.localStorage.setItem(draftKey, body)')
  })
})
