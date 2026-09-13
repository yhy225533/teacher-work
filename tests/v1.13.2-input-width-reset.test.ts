import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(join(__dirname, '..', relativePath), 'utf8')
}

/**
 * V1.13.2 修复钉测：全局 input{width:100%} 把 flex 行内的裸 radio/checkbox 撑满整行——
 * prep-scope-option（"这份讲义/整个课件包"两卡）文字 span 被挤成 0 宽竖排溢出（V19-A 起既有，
 * 真实鼠标探针 probe-draft-rail 实测 input≈250px / main 0×281）。统一回 intrinsic 宽。
 * 几何级实证依赖 tmp/v113-smoke/probe-draft-rail.mjs（getBoundingClientRect 断言）。
 */
describe('V1.13.2 裸 radio/checkbox 宽度复位（AI 修改对话栏卡竖排文字修复）', () => {
  it('scope/file-list/bank candidates/bank controls 的裸 radio/checkbox 全部 width:auto', () => {
    const styles = source('src/renderer/styles.css')
    expect(styles).toContain(
      '.prep-scope-option input,\n.prep-scope-file-list input,\n.improve-bank-candidates input,\n.prep-bank-controls-inner input[type=\'checkbox\'] {',
    )
    const block = styles.slice(styles.indexOf('.prep-scope-option input,'), styles.indexOf('.prep-scope-option input,') + 240)
    expect(block).toContain('width: auto;')
    expect(block).toContain('padding: 0;')
    expect(block).toContain('flex-shrink: 0;')
  })

  it('covers every bare radio/checkbox container in the prep workspace (audit pin)', () => {
    // draft-panel 内裸 radio/checkbox 的容器全集（prep-switch-input 为 absolute 隐藏，不在列）
    const panel = source('src/renderer/draft-panel.tsx')
    const containers = [
      'prep-scope-option', // 这份讲义/整个课件包 radio ×2
      'prep-scope-file-list', // 目标/参考文件选择列表 radio/checkbox
      'improve-bank-candidates', // 题库候选 checkbox
      'prep-bank-controls-inner', // 同时生成学生版 checkbox
    ]
    for (const cls of containers) {
      if (cls === 'prep-scope-option' || cls === 'prep-scope-file-list' || cls === 'improve-bank-candidates') {
        expect(panel).toContain(cls)
      }
    }
    const styles = source('src/renderer/styles.css')
    for (const cls of containers) {
      expect(styles).toContain(cls)
    }
  })
})
