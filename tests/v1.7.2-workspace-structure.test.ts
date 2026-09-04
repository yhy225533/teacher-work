import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

// V1.7.2（D33）：备课工作台结构重排——左轨只放修改记录，配置收进主区生成器卡，阅读态生成器收成摘要条。
describe('V172-A 工作台骨架：左轨 / 生成器范围行 / 收起态', () => {
  it('renders the rail with the modification-record timeline only', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    expect(draft).toContain('workspace-card prep-rail" aria-label="修改记录"')
    expect(draft).toContain('prep-rail-head')
    expect(draft).toContain('修改记录')
    expect(draft).toContain('{lessonResults.length} 份')
    expect(draft).toContain('还没有修改节点。右侧生成后，每个节点都会出现在这里。')
    expect(draft).toContain('prep-rail-foot')
    expect(draft).toContain('生成的每个节点都会保留在这里，点开即回看，AI 结果永不覆盖原件。')
  })

  it('renders the single-mode target card with picker collapse behind 更换', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    expect(draft).toContain('prep-target-card')
    expect(draft).toContain('prep-file-glyph')
    expect(draft).toContain('{targetFile?.originalName ?? \'尚未选择\'}')
    expect(draft).toContain("targetPickerOpen ? (")
    expect(draft).toContain('onClick={() => setTargetPickerOpen(true)}>更换')
    expect(draft).toContain('onClick={() => setTargetPickerOpen(false)}>收起')
    // 选中即收起（规则 1）
    const selectTarget = draft.slice(draft.indexOf('function selectTargetFile'), draft.indexOf('function changePrepMode'))
    expect(selectTarget).toContain('setTargetPickerOpen(false)')
    // 候选多于一份才出现"更换"
    expect(draft).toContain('modifiableCurrentFiles.length > 1')
    expect(draft).toContain('AI 只改这份文件，未提及部分保持不变')
  })

  it('renders the lesson-mode auto chip and keeps the scope note inline', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    expect(draft).toContain('prep-auto-chip')
    expect(draft).toContain('本课全部课件')
    expect(draft).toContain('{lessonBaselineFiles.length} 份 · 自动纳入最新正式版，历史版本不参与')
    expect(draft).toContain('输出一份完整新版本（讲义 + 例题 + 课堂练习 + 课后作业）')
  })

  it('collapses the generator into a summary strip when a node is selected', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    expect(draft).toContain('generatorOpen || selectedNote === undefined ? (')
    expect(draft).toContain('prep-generator is-collapsed')
    expect(draft).toContain('prep-collapsed-sum')
    expect(draft).toContain('调整要求')
    expect(draft).toContain("setGeneratorOpen(selectedNoteId === null)")
    expect(draft).toContain("setGeneratorOpen(true)")
  })

  it('wraps result content in the prep-doc-card and keeps grid width at 250px', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    expect(draft).toContain('workspace-card prep-doc-card')
    expect(styles).toContain('grid-template-columns: 250px minmax(0, 1fr);')
    expect(styles).toContain('.prep-rail {')
    expect(styles).toContain('.prep-main {')
    expect(styles).toContain('.prep-generator {')
    expect(styles).toContain('.prep-generator.is-collapsed {')
    // 1100px 断点：单列堆叠 + 左轨取消 sticky
    const media = styles.slice(styles.indexOf('@media (max-width: 1100px)'))
    expect(media).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(media).toContain('.prep-rail {')
  })

  it('removes the retired V1.5 left-column configuration blocks', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    for (const retired of [
      'prep-ref-panel',
      'prep-work-panel',
      'prep-scope-strip',
      'prep-auto-scope',
      'prep-reference-section',
      'prep-reference-hint',
      'draft-prompt-block',
      'draft-prompt-actions',
      '选择一份课件版本',
      '本课全部内容',
      '先确定修改对象，再选择可选参考',
    ]) {
      expect(draft).not.toContain(retired)
      expect(styles).not.toContain(`.${retired}`)
    }
  })

  it('updates the mode-bar subtitle and new-mode caption wording', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    expect(draft).toContain('配置都在右侧生成器里，一行一类')
    expect(draft).toContain("'修改要求'")
    expect(draft).toContain("'整课重做要求'")
    expect(draft).toContain("'生成要求'")
    expect(draft).not.toContain('单文件修改要求')
  })

  it('D35: target count is a free-fill number input clamped to the 1..80 contract bound', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const contracts = source('../src/shared/draft-contracts.ts')

    // 控件：number input + datalist 快捷项（可选可填），两处模式共用 PrepBankOptions 组件
    expect(draft).toContain('function PrepBankOptions(')
    expect(draft).toContain('prep-bank-count-input')
    expect(draft).toContain('prep-bank-count-presets')
    expect(draft).toContain('BANK_TARGET_COUNT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 40, 50, 80]')
    expect(draft).not.toContain('BANK_TARGET_COUNTS.map((count) => (\n                      <option')
    // 钳制：超限 Math.min 到 80；清空/非法回退已提交值（不误回默认）
    expect(draft).toContain('Math.min(parsed, DRAFT_BANK_PLAN_MAX_TARGET_COUNT)')
    expect(draft).toContain(': bankTargetCount')
    // 合同边界 1..80
    expect(contracts).toContain('DRAFT_BANK_PLAN_MAX_TARGET_COUNT = 80')
    expect(draft).toContain('min={DRAFT_BANK_PLAN_MIN_TARGET_COUNT}')
    expect(draft).toContain('max={DRAFT_BANK_PLAN_MAX_TARGET_COUNT}')
  })
})
