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
