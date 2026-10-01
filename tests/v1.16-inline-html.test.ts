import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MarkdownDocument } from '../src/renderer/lesson-material-reader'

describe('V1.16 思源残留 HTML 渲染', () => {
  it('剥掉 <span> 标签与属性，只留文字（产品负责人截图场景）', () => {
    const body = [
      '#### 2.1 三角形不等式',
      '',
      '- <span data-type="text" style="font-size: 20px;">铁律：三角形中，任意两边之和【必须严格大于】第三边。</span>',
      '',
      '<span data-type="text" style="white-space:pre">\t</span>当题目中出现两个完全不知道的数字。',
    ].join('\n')
    const markup = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    expect(markup).toContain('铁律：三角形中，任意两边之和【必须严格大于】第三边。')
    expect(markup).not.toContain('data-type')
    expect(markup).not.toContain('font-size')
    expect(markup).not.toContain('&lt;span')
    expect(markup).not.toContain('&lt;/span')
  })

  it('<br /> 渲染为真实换行，不显示字面标签', () => {
    const body = '|A 说真话<br />（B、C、D 为假）|推导事实：B 是肇事者|'
    const markup = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    expect(markup).not.toContain('&lt;br')
    expect(markup).toContain('<br/>')
  })

  it('<sup> 保留上标语义（90<sup>0</sup> = 90 度）', () => {
    const body = '∠ABC=90<sup>0</sup>，取中点。'
    const markup = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    expect(markup).toContain('90<sup>0</sup>')
    expect(markup).not.toContain('&lt;sup')
  })

  it('数学比较号不被误当 HTML（$0<x<10$ / 在 $x<h$ 时）', () => {
    const body = [
      '由于边长为正数，所以 $0<x<10$。',
      '',
      '当 $a>0$ 时，在 $x<h$ 时，$y$ 随 $x$ 的增大而减小。',
      '',
      '如果三条边是 a、b、c，必须满足 $a+b>c$。',
    ].join('\n')
    const markup = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    // 数学内容原样保留，且不能出现被吃掉字符（如 x<10 变成 10）
    expect(markup).toContain('katex')
    expect(markup).toContain('0&lt;x&lt;10')   // KaTeX 会把 < 转义
    expect(markup).toContain('x&lt;h')
    expect(markup).toContain('a+b&gt;c')
  })

  it('标签包裹的行内 markdown 仍生效（<span>**粗体**</span>）', () => {
    const body = '<span style="font-size:24px;">**本质总结：**</span>'
    const markup = renderToStaticMarkup(createElement(MarkdownDocument, { body, files: [] }))
    expect(markup).toContain('<strong>本质总结：</strong>')
    expect(markup).not.toContain('font-size')
  })
})
