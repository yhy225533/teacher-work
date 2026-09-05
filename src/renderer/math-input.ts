/**
 * V1.7.3（D36）：MD 编辑器公式输入引擎——纯函数与数据表，零依赖。
 * 数学模式侦测、缩写自动展开、自动分式、Tab 槽位跳转与斜杠命令共用（V173-B）。
 */

/**
 * 光标前文本（beforeCaret）判定：是否处于 $…$ / $$…$$ 公式内。
 * 自左向右扫描：`$$` 作为单个定界 token 翻转一次，单个 `$` 翻转一次——块级/行内公式统一正确。
 */
export function inMathMode(beforeCaret: string): boolean {
  let inMath = false
  let index = 0
  while (index < beforeCaret.length) {
    if (beforeCaret.charAt(index) !== '$') {
      index += 1
      continue
    }
    inMath = !inMath
    index += beforeCaret.charAt(index + 1) === '$' ? 2 : 1
  }
  return inMath
}

/** 数学模式缩写表：空格触发，最长触发词优先（matchMathSnippet 按长度降序匹配）。 */
export const MATH_SNIPPETS: readonly {
  /** 触发缩写（光标前文本以它结尾即命中） */
  readonly trigger: string
  /** 展开后的 LaTeX；空 {} 为槽位，首个槽位为初始光标 */
  readonly replacement: string
  /** 符号条 chip 文案（数学态工具栏） */
  readonly label: string
}[] = [
  { trigger: 'sqrt', replacement: '\\sqrt{}', label: '根号 √' },
  { trigger: 'frac', replacement: '\\frac{}{}', label: '分式 a/b' },
  { trigger: 'cfrac', replacement: '\\cfrac{}{}', label: '大分式' },
  { trigger: 'sum', replacement: '\\sum_{}^{}', label: '求和 ∑' },
  { trigger: 'int', replacement: '\\int_{}^{}', label: '积分 ∫' },
  { trigger: 'lim', replacement: '\\lim_{x \\to }', label: '极限' },
  { trigger: 'mat', replacement: '\\begin{pmatrix} {} & {} \\\\ {} & {} \\end{pmatrix}', label: '矩阵 2×2' },
  { trigger: 'cases', replacement: '\\begin{cases} {} \\\\ {} \\end{cases}', label: '方程组' },
  { trigger: 'pi', replacement: '\\pi', label: 'π' },
  { trigger: 'theta', replacement: '\\theta', label: 'θ' },
  { trigger: 'alpha', replacement: '\\alpha', label: 'α' },
  { trigger: 'beta', replacement: '\\beta', label: 'β' },
  { trigger: 'Delta', replacement: '\\Delta', label: 'Δ' },
  { trigger: 'le', replacement: '\\le', label: '≤' },
  { trigger: 'ge', replacement: '\\ge', label: '≥' },
  { trigger: 'ne', replacement: '\\ne', label: '≠' },
  { trigger: 'app', replacement: '\\approx', label: '≈' },
  { trigger: 'deg', replacement: '^\\circ', label: '°' },
  { trigger: 'vec', replacement: '\\vec{}', label: '向量' },
  { trigger: 'hat', replacement: '\\hat{}', label: '帽子' },
  { trigger: 'bar', replacement: '\\overline{}', label: '上划线' },
  { trigger: 'angle', replacement: '\\angle', label: '∠' },
  { trigger: 'tri', replacement: '\\triangle', label: '△' },
  { trigger: 'perp', replacement: '\\perp', label: '⊥' },
  { trigger: 'par', replacement: '\\parallel', label: '∥' },
  { trigger: 'cong', replacement: '\\cong', label: '≌' },
  { trigger: 'sim', replacement: '\\sim', label: '∽' },
  { trigger: 'cdot', replacement: '\\cdot', label: '·' },
  { trigger: 'times', replacement: '\\times', label: '×' },
  { trigger: 'infty', replacement: '\\infty', label: '∞' },
  { trigger: 'because', replacement: '\\because', label: '因为' },
  { trigger: 'therefore', replacement: '\\therefore', label: '所以' },
  { trigger: 'quad', replacement: '\\quad', label: '空格' },
]

/** 按触发词长度降序（等长按字典序）排列的匹配副本，保证确定性。 */
const SNIPPETS_BY_LENGTH: readonly (typeof MATH_SNIPPETS)[number][] = [...MATH_SNIPPETS].sort(
  (a, b) => b.trigger.length - a.trigger.length || a.trigger.localeCompare(b.trigger),
)

/**
 * 缩写匹配：光标前文本以某触发词结尾则命中。
 * 词边界：触发词前一字符若是 ASCII 字母/数字，视为更长单词的一部分，不展开（`limx` 不匹配 `lim`）。
 * 仅在数学模式内调用（正文英文单词不被拦截）。
 */
export function matchMathSnippet(beforeCaret: string): { readonly trigger: string; readonly replacement: string } | null {
  for (const snippet of SNIPPETS_BY_LENGTH) {
    const { trigger } = snippet
    if (!beforeCaret.endsWith(trigger)) continue
    const prev = beforeCaret.charAt(beforeCaret.length - trigger.length - 1)
    if (prev !== '' && /[A-Za-z0-9]/u.test(prev)) continue
    return { trigger, replacement: snippet.replacement }
  }
  return null
}

/**
 * 自动分式：数学模式内按 `/` 时，光标前是原子（字母数字串或 {} 组）→ 返回原子与删除长度；
 * 光标前无原子（如紧跟运算符/行首）返回 null，正常输入 `/`。
 */
export function matchFractionAtom(beforeCaret: string): { readonly atom: string; readonly cut: number } | null {
  const match = /(\{[^{}]*\}|[A-Za-z0-9]+)$/u.exec(beforeCaret)
  if (match === null) return null
  const raw = match[1] ?? ''
  const atom = raw.startsWith('{') ? raw.slice(1, -1) : raw
  if (atom === '') return null
  return { atom, cut: raw.length }
}

/** 自动分式展开文本：原子上移分子，光标留给分母（首个空 {}）。 */
export function fractionReplacement(atom: string): string {
  return `\\frac{${atom}}{}`
}

/** Tab 槽位跳转：光标后文本 → 跳转偏移（相对光标，0 = 不动）。空 {} → 跳进；其后 } → 跳出；再后 $/$$ → 出公式。 */
export function nextSlotOffset(afterCaret: string): number {
  const emptySlot = /^([^{}]*)\{\}/u.exec(afterCaret)
  if (emptySlot !== null) return emptySlot[0].length - 1
  const closingBrace = /^([^{}]*)\}/u.exec(afterCaret)
  if (closingBrace !== null) return closingBrace[0].length
  if (afterCaret.startsWith('$$')) return 2
  if (afterCaret.startsWith('$')) return 1
  const closingDollar = afterCaret.indexOf('$')
  if (closingDollar !== -1) return closingDollar + 1
  return 0
}

/**
 * 展开后的光标偏移：首个空 {} 槽位内；无槽位则落在展开文本末尾。
 * 已填参数的括号（如自动分式的分子 {x}）不是空槽位，天然让位给空分母。
 */
export function expansionCaretOffset(replacement: string): number {
  const slot = /\{\}/u.exec(replacement)
  if (slot === null) return replacement.length
  return slot.index + 1
}

/** 斜杠命令插入模板中的光标占位符（U+0000，不会出现在正常 md 正文里）。 */
export const SLASH_CURSOR = '\u0000'

/**
 * 斜杠命令表：空行 `/`（或中文顿号 `、`）触发的块模板菜单项，值为纯文本模板。
 * 过滤词 = 拼音缩写 + 中文名 + 英文名（startsWith 匹配）。
 */
export const SLASH_ITEMS: readonly {
  /** 菜单名称 */
  readonly name: string
  /** 过滤词（拼音缩写 / 中文 / 英文，不区分大小写比较） */
  readonly keywords: readonly string[]
  /** 插入模板（SLASH_CURSOR 为光标占位符） */
  readonly insert: string
}[] = [
  { name: '块级公式 $$…$$', keywords: ['gs', 'sxgsk', 'ksgs', 'gongshi', '公式', '块级公式', 'math'], insert: '$$\n' + SLASH_CURSOR + '\n$$' },
  { name: '行内公式 $x$', keywords: ['hjgs', 'inline', 'gs', '行内', '行内公式'], insert: '$' + SLASH_CURSOR + '$' },
  { name: '方程组 cases', keywords: ['fzc', 'cases', 'jt', '方程组', '解方程'], insert: '$$\n\\begin{cases}\n  ' + SLASH_CURSOR + ' \\\\\n  \n\\end{cases}\n$$' },
  { name: '3×3 矩阵', keywords: ['jz', 'matrix', 'juzhen', '矩阵'], insert: '$$\n\\begin{pmatrix}\n  ' + SLASH_CURSOR + ' & & \\\\\n  & & \\\\\n  & &\n\\end{pmatrix}\n$$' },
  { name: '表格 3×2', keywords: ['bg', 'table', 'biaoge', '表格'], insert: '\n| 列1 | 列2 |\n| --- | --- |\n|  |  |\n' },
  { name: '分隔线', keywords: ['fgx', 'hr', 'fengexian', '分隔线'], insert: '\n---\n' },
  { name: '引用', keywords: ['qy', 'yy', 'quote', 'yinyong', '引用'], insert: '> ' },
  { name: '一级标题', keywords: ['bt', 'h1', 'biaoti', '标题', '一级标题'], insert: '# ' },
  { name: '二级标题', keywords: ['ejbt', 'h2', '二级标题'], insert: '## ' },
  { name: '三级标题', keywords: ['sjbt', 'h3', '三级标题'], insert: '### ' },
  { name: '有序列表', keywords: ['yxlb', 'ol', '有序', '列表'], insert: '1. ' },
  { name: '无序列表', keywords: ['wxlb', 'ul', '无序', '列表'], insert: '- ' },
]

/** 斜杠过滤：query 对某项任一过滤词 startsWith 即命中；query 为空返回全量。 */
export function filterSlashItems(query: string): (typeof SLASH_ITEMS)[number][] {
  const q = query.trim().toLowerCase()
  if (q === '') return [...SLASH_ITEMS]
  return SLASH_ITEMS.filter((item) =>
    item.keywords.some((keyword) => keyword.toLowerCase().startsWith(q)),
  )
}

/** 剥离模板光标占位符 → 插入文本 + 光标偏移（占位符处；其右侧紧跟空 {} 槽位时优先落槽位）。 */
export function resolveSlashInsert(template: string): { readonly text: string; readonly caret: number } {
  const cursorIndex = template.indexOf(SLASH_CURSOR)
  if (cursorIndex === -1) return { text: template, caret: template.length }
  const text = template.slice(0, cursorIndex) + template.slice(cursorIndex + SLASH_CURSOR.length)
  const slotAfter = /\{\}/u.exec(template.slice(cursorIndex + SLASH_CURSOR.length))
  if (slotAfter !== null) return { text, caret: cursorIndex + slotAfter.index + 1 }
  return { text, caret: cursorIndex }
}

/** 斜杠触发判定：光标所在行 trim 后为空（空行才允许唤出菜单）。 */
export function isSlashLineStart(beforeCaret: string): boolean {
  const lineStart = Math.max(beforeCaret.lastIndexOf('\n') + 1, 0)
  return beforeCaret.slice(lineStart).trim() === ''
}
