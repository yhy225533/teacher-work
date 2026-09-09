import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('V110-C generation kind buttons (problem 4)', () => {
  it('renders three side-by-side kind buttons in new prep mode, each firing generate(kind) directly', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    const sayBlock = draft.slice(
      draft.indexOf('<div className="prep-chat-say">'),
      draft.indexOf("{improveError !== '' && <p"),
    )
    expect(sayBlock).toContain('prep-kind-buttons')
    expect(sayBlock).toContain('Object.values(DRAFT_KINDS).map')
    expect(sayBlock).toContain('void generate(kind)')
    // 生成中：三按钮全禁用，所点按钮显示「生成中…」
    expect(sayBlock).toContain('busyAction === kind')
    expect(sayBlock).toContain('生成中…')
  })

  it('withdraws the kind dropdown and improveKind state while keeping the generate contract single-kind', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const contracts = source('../src/shared/draft-contracts.ts')

    expect(draft).not.toContain('生成类型：')
    expect(draft).not.toContain('improveKind')
    expect(draft).not.toContain('setImproveKind')
    // 合同零改动：kind 仍单值，一次一请求
    expect(contracts).toContain("export const DRAFT_KINDS = {")
    expect(contracts).toContain("lecture: 'lecture',")
    expect(contracts).toContain("example: 'example',")
    expect(contracts).toContain("homework: 'homework',")
    const generateCall = draft.slice(
      draft.indexOf('const result = await window.teacherWorkbench.drafts.generate({'),
      draft.indexOf('maxTokens: DRAFT_DEFAULT_MAX_TOKENS,'),
    )
    expect(generateCall).toContain('kind,')
  })

  it('keeps the single send button and plan flow for single/lesson modes untouched', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    // single/lesson：✦ 发送只走 startImprovePlan（方案确认流）；确认生成仍经 plannedDraftKind 推导
    expect(draft).toContain("void startImprovePlan()")
    expect(draft).toContain('void confirmPlanAndGenerate(plannedDraftKind)')
    // plannedDraftKind 保留 lesson → lecture 与 single → inferDraftKind 推导（new 分支撤除）
    expect(draft).toContain("const plannedDraftKind = prepMode === 'lesson'")
    expect(draft).toContain('? DRAFT_KINDS.lecture')
    expect(draft).toContain(': inferDraftKind(targetFile)')
    // 三按钮不重排对话栏：依据区/Skill/预算行结构保留
    expect(draft).toContain('prep-chat-basis-label')
    expect(draft).toContain('Skill：')
    expect(draft).toContain('prep-chat-budget')
  })

  it('styles the kind button group as an equal three-column row', () => {
    const styles = source('../src/renderer/styles.css')

    expect(styles).toContain('.prep-kind-buttons {')
    expect(styles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
  })
})
