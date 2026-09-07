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

  it('V172-fix: new-prep mode keeps external and materials add entries wired', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    // 三种模式都必须能进入外部资料/素材库 picker：single/lesson 参考行 + new 选中态小入口 + new 冷启动大卡（V172-B）
    expect(draft.match(/onClick=\{onBrowseExternal\}/g)).toHaveLength(3)
    expect(draft.match(/onClick=\{onBrowseMaterials\}/g)).toHaveLength(3)
    // new 模式入口不依赖课内资料存在（冷启动课次无文件时仍可添加）
    const newRow = draft.slice(draft.indexOf("{prepMode === 'new' && ("), draft.indexOf('<div className="prep-gen-req">'))
    expect(newRow).toContain('从外部资料添加')
    expect(newRow).toContain('从素材库添加')
  })

  it('V1.7.2: scope file rows render a source badge from lessonFileSourceLabel', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const context = source('../src/renderer/lesson-prep-context.ts')
    const styles = source('../src/renderer/styles.css')

    // ScopeFileList 行内末尾来源小标签（生成依据/补充参考/更换列表三处共用）
    expect(draft).toContain('lessonFileSourceLabel(file) !== null')
    expect(draft).toContain('prep-source-badge')
    expect(context).toContain("export type LessonFileSourceLabel = '外部资料' | '素材库'")
    expect(context).toContain('originFileId === null ? \'外部资料\' : \'素材库\'')
    // AI 版本链（含学生版）与编辑版命名不标来源
    expect(context).toContain('appGeneratedNamePattern')
    expect(styles).toContain('.prep-source-badge {')
  })

  it('V172-B: bank options live in the candidates-section header only', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    // 唯一 PrepBankOptions 实例位于 improve-bank-section 头部 prep-bank-controls（§5.8）
    expect(draft.match(/<PrepBankOptions/g)).toHaveLength(1)
    const bankSection = draft.slice(draft.indexOf('improve-bank-section'), draft.indexOf('<p className="improve-bank-plan">'))
    expect(bankSection).toContain('prep-bank-controls')
    expect(bankSection).toContain('<PrepBankOptions')
    expect(bankSection).toContain('正在选题…')
    // 生成器参考行/生成依据行不再渲染题库参数（过渡态退役）
    const generator = draft.slice(draft.indexOf('prep-generator" aria-label'), draft.indexOf('<div className="prep-gen-req">'))
    expect(generator).not.toContain('PrepBankOptions')
    expect(generator).not.toContain('目标题数')
    // 旧行内块 CSS 退役，count-input 保留
    expect(styles).not.toContain('.prep-bank-toggle')
    expect(styles).not.toContain('.prep-bank-options')
    expect(styles).toContain('.prep-bank-controls')
    expect(styles).toContain('.prep-bank-count-input')
  })

  it('V172-B: new-mode cold start renders two big add cards, selected renders chips', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    // 冷启动（0 选中）：两张 prep-add-card 大卡（§5.6），取代常驻勾选列表与小按钮行
    const newRow = draft.slice(draft.indexOf("{prepMode === 'new' && ("), draft.indexOf('<div className="prep-gen-req">'))
    expect(newRow).toContain('prep-add-cards')
    expect(newRow).toContain('从外部资料添加')
    expect(newRow).toContain('从已登记的外部资料根目录中选择文件作为生成依据')
    expect(newRow).toContain('从素材库添加')
    expect(newRow).toContain('从素材库挑取素材插入本课资料')
    // 大卡下方一行：muted 提示 + （有候选时）"＋ 从本课资料选择" + 题库开关
    expect(newRow).toContain('已选 0 份 · 也可以只靠要求直接生成')
    expect(newRow).toContain('＋ 从本课资料选择')
    expect(newRow).toContain('prep-switch-row')
    // 有选中：与参考行同构的 chips（✕ = toggleReferenceFile）＋ 三个小入口 ＋ 题库开关（§5.6 第一条）
    expect(newRow).toContain('selectedReferenceFileIds.length > 0 ? (')
    expect(newRow).toContain('移除依据')
    expect(newRow).toContain('onClick={() => toggleReferenceFile(file.id)}')
    expect(newRow).toContain('＋ 本课资料')
    // 大卡 CSS 落地
    expect(styles).toContain('.prep-add-cards {')
    expect(styles).toContain('.prep-add-card {')
    expect(styles).toContain('.prep-add-card-plus {')
  })

  it('V172-C: main empty state is a per-mode guidance card', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    // 卡片化：workspace-card draft-content-empty（§5.2/§8）
    expect(draft).toContain('workspace-card draft-content-empty')
    // 分模式文案：new vs single/lesson（§8）
    expect(draft).toContain('先添加生成依据（或直接写要求），点「生成讲义」即可出第一版；生成后节点出现在左侧修改记录里，随时回看与继续修改。')
    expect(draft).toContain('修改方案生成后先在这里审阅，确认后才会生成新副本；节点会出现在左侧修改记录里。')
    // 旧通用文案退役
    expect(draft).not.toContain('左侧选择修改节点，或在上方生成新内容')
    // CSS 落地
    expect(styles).toContain('.workspace-card.draft-content-empty {')
  })

  it('V172-C: improve-review-card keeps an independent card look without workspace-card', () => {
    const styles = source('../src/renderer/styles.css')

    // §5.2 核查结论：.improve-review-card 自带独立边框与内边距（卡片视觉齐备），不再叠加 workspace-card
    const block = styles.slice(styles.indexOf('.improve-review-card {'), styles.indexOf('.improve-plan-body {'))
    expect(block).toContain('border:')
    expect(block).toContain('padding:')
    expect(block).not.toContain('workspace-card')
  })

  it('V172-C: collapse rules are pinned (select→collapse, adjust→expand, no-selection stays open)', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    // 规则 4：选中节点自动收起、无选中强制展开（V172-A 落地，V172-C 钉测防回归）
    expect(draft).toContain('setGeneratorOpen(selectedNoteId === null)')
    // 展开态与收起态互斥渲染
    expect(draft).toContain('generatorOpen || selectedNote === undefined ? (')
    expect(draft).toContain('prep-generator is-collapsed')
    // "调整要求"按钮在收起条内（重展开入口）
    const collapsed = draft.slice(draft.indexOf('is-collapsed'), draft.indexOf('</section>', draft.indexOf('is-collapsed')))
    expect(collapsed).toContain('调整要求')
    // 规则 5：abandon/startImprovePlan 取消路径强制展开（可改要求重试）
    const abandonFn = draft.slice(draft.indexOf('function abandonImprove'), draft.indexOf('function abandonImprove') + 700)
    expect(abandonFn).toContain('setGeneratorOpen(true)')
  })
})
