import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

// V1.7.2（D33）备课工作台结构重排——V19-A（D55/D56）演进为「对话栏 + 主舞台」两栏：
// 左轨修改记录收为顶部浮层、生成器卡撤除、模式行撤除。本组钉测按新结构重钉，
// V1.7.2 验收语义（配置在主区、收起规则、题库控件收口、空态引导）随新结构演进不改写。
describe('V172-A → V19-A 工作台骨架：对话栏 / 主舞台 / 修改记录浮层', () => {
  it('renders the modification record as a header drawer button instead of a left rail', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    // 修改记录默认收起（0 占版面）：页面头「🕘 修改记录 N」按钮 + Drawer 浮层
    expect(draft).toContain('🕘 修改记录 {lessonResults.length}')
    expect(draft).toContain('prep-history-drawer')
    expect(draft).toContain('aria-label="修改记录"')
    expect(draft).toContain('关闭修改记录')
    // 浮层条目 = 原 rail 行内容（节点名/时间/教师版学生版徽标/修改中已确认/删除）
    expect(draft).toContain('draft-result-list prep-history-list')
    expect(draft).toContain('draft-variant-badge is-teacher')
    expect(draft).toContain('draft-variant-badge is-student')
    expect(draft).toContain("draft-status-${note.draftStatus}")
    expect(draft).toContain('还没有修改节点。生成后每个节点都会出现在这里，AI 结果永不覆盖原件。')
    // 旧左轨退役
    expect(draft).not.toContain('prep-rail"')
    expect(draft).not.toContain('prep-rail-head')
    expect(draft).not.toContain('prep-rail-foot')
  })

  it('renders the single-mode target card with picker collapse behind 更换 in the chat basis', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    expect(draft).toContain('prep-target-card')
    expect(draft).toContain('prep-file-glyph')
    expect(draft).toContain('{targetFile?.originalName ?? \'尚未选择\'}')
    expect(draft).toContain('scopePickerOpen ? (')
    expect(draft).toContain('onClick={() => setScopePickerOpen(true)}>更换')
    expect(draft).toContain('onClick={() => setScopePickerOpen(false)}>收起')
    // 选中即收起（沿用 V172-A 规则 1）
    const selectTarget = draft.slice(draft.indexOf('function selectTargetFile'), draft.indexOf('function selectChatScope'))
    expect(selectTarget).toContain('setScopePickerOpen(false)')
    // 候选多于一份才出现"更换"
    expect(draft).toContain('modifiableCurrentFiles.length > 1')
  })

  it('maps the chat scope radio 这份讲义/整个课件包 onto the retained prepMode contract', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    // 模式行撤除；"这次改什么" radio 两项：single（自动挂当前讲义）｜lesson（N 份当前版课件）
    expect(draft).not.toContain('prep-mode-bar')
    expect(draft).not.toContain('prep-mode-switch')
    expect(draft).not.toContain('修改当前文件')
    expect(draft).not.toContain('整课重做</button>')
    expect(draft).toContain('这次改什么')
    expect(draft).toContain('这份讲义')
    expect(draft).toContain('整个课件包')
    expect(draft).toContain('自动挂当前讲义，AI 只改这份，未提及部分保持不变')
    expect(draft).toContain('份当前版课件全部重做（讲义 + 例题 + 练习 + 作业）')
    expect(draft).toContain('prep-auto-badge')
    expect(draft).toContain("function selectChatScope(nextMode: Exclude<PrepLaunchMode, 'new'>)")
    expect(draft).toContain("selectChatScope('single')")
    expect(draft).toContain("selectChatScope('lesson')")
    // 合同层 prepMode 保留：初始化 effect 与生成载荷仍以 prepMode 驱动（D55 零合同改动）
    expect(draft).toContain('setPrepMode(scope.mode)')
    expect(draft).toContain('prepMode === \'lesson\' ? DRAFT_KINDS.lecture')
  })

  it('keeps the chat rail resident (no generator collapse) with a manual collapse for narrow windows', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    // 生成器卡与收起规则 1-5 随生成器撤除退役；对话栏常驻（随时可改要求再发送）
    expect(draft).not.toContain('generatorOpen')
    expect(draft).not.toContain('prep-generator')
    expect(draft).not.toContain('prep-collapsed-sum')
    expect(draft).not.toContain('setGeneratorOpen')
    // 对话栏折叠为摘要条（1100px 堆叠态 / 手动折叠），点开还原
    expect(draft).toContain('chatCollapsed')
    expect(draft).toContain('prep-chat-collapsed')
    expect(draft).toContain('展开对话栏')
  })

  it('wraps stage states in prep-stage cards and keeps the two-column grid at 302px chat width', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    expect(draft).toContain('workspace-card prep-stage" aria-label="修改方案"')
    expect(draft).toContain('workspace-card prep-stage is-streaming')
    expect(draft).toContain('workspace-card prep-stage is-result')
    expect(styles).toContain('.prep-stage {')
    // 主舞台 minmax(0,1fr) ｜ 对话栏 302px（方案 §3.1）
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) 302px;')
    expect(styles).toContain('.prep-main {')
    expect(styles).toContain('.prep-chat {')
    // 1100px 断点：单列堆叠
    const media = styles.slice(styles.indexOf('@media (max-width: 1100px)'))
    expect(media).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(media).toContain('.prep-chat {')
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

  it('D35: target count is a free-fill number input clamped to the 1..80 contract bound', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const contracts = source('../src/shared/draft-contracts.ts')

    // 控件：number input + datalist 快捷项（可选可填），对话栏题库开关行内 PrepBankOptions
    expect(draft).toContain('function PrepBankOptions(')
    expect(draft).toContain('prep-bank-count-input')
    expect(draft).toContain('prep-bank-count-presets')
    expect(draft).toContain('BANK_TARGET_COUNT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 40, 50, 80]')
    // 钳制：超限 Math.min 到 80；清空/非法回退已提交值（不误回默认）
    expect(draft).toContain('Math.min(parsed, DRAFT_BANK_PLAN_MAX_TARGET_COUNT)')
    expect(draft).toContain(': bankTargetCount')
    // 合同边界 1..80
    expect(contracts).toContain('DRAFT_BANK_PLAN_MAX_TARGET_COUNT = 80')
    expect(draft).toContain('min={DRAFT_BANK_PLAN_MIN_TARGET_COUNT}')
    expect(draft).toContain('max={DRAFT_BANK_PLAN_MAX_TARGET_COUNT}')
  })

  it('V172-fix→V19-A: new-prep mode keeps external and materials add entries wired', () => {
    const draft = source('../src/renderer/draft-panel.tsx')

    // new 模式（空课次从零生成）依据区：冷启动大卡 + 选中态 chips + 三小入口；
    // single/lesson 模式补充参考行也保留外部/素材库入口（共 3 处，与 V172-fix 语义同宽）
    expect(draft.match(/onClick=\{onBrowseExternal\}/g)).toHaveLength(3)
    expect(draft.match(/onClick=\{onBrowseMaterials\}/g)).toHaveLength(3)
    const newBasis = draft.slice(draft.indexOf("{prepMode === 'new' ? ("), draft.indexOf('<div className="prep-chat-basis">'))
    expect(newBasis).toContain('从外部资料添加')
    expect(newBasis).toContain('从素材库添加')
    expect(newBasis).toContain('prep-add-cards')
    expect(newBasis).toContain('prep-add-card"')
  })

  it('V1.7.2: scope file rows render a source badge from lessonFileSourceLabel', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const context = source('../src/renderer/lesson-prep-context.ts')
    const styles = source('../src/renderer/styles.css')

    // ScopeFileList 行内末尾来源小标签（依据/参考/更换列表三处共用）
    expect(draft).toContain('lessonFileSourceLabel(file) !== null')
    expect(draft).toContain('prep-source-badge')
    expect(context).toContain("export type LessonFileSourceLabel = '外部资料' | '素材库'")
    expect(context).toContain('originFileId === null ? \'外部资料\' : \'素材库\'')
    expect(context).toContain('appGeneratedNamePattern')
    expect(styles).toContain('.prep-source-badge {')
  })

  it('V172-B→V19-A: bank options live in the chat bank row; plan-stage shows candidates inline', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    // 唯一 PrepBankOptions 实例位于对话栏题库开关展开行（§3.2 开关行含 PrepBankOptions）
    expect(draft.match(/<PrepBankOptions/g)).toHaveLength(1)
    const chatBank = draft.slice(draft.indexOf('参考题库'), draft.indexOf('<p className={`prep-chat-budget'))
    expect(chatBank).toContain('prep-bank-controls')
    expect(chatBank).toContain('<PrepBankOptions')
    // 方案态候选列表就地渲染（prep-stage-bank 内，逐题剔除/调整重选行内），确认条三键在卡底
    const stageBank = draft.slice(draft.indexOf('prep-stage-bank"'), draft.indexOf('prep-stage-actions">'))
    expect(stageBank).toContain('improve-bank-candidates')
    expect(stageBank).toContain('toggleBankCandidate')
    expect(stageBank).toContain('调整后重新选题')
    expect(stageBank).not.toContain('PrepBankOptions')
    expect(draft).toContain('✓ 确认并生成')
    expect(draft).toContain('让 AI 调整')
    // 旧行内块 CSS 退役，count-input 保留
    expect(styles).not.toContain('.prep-bank-toggle')
    expect(styles).not.toContain('.prep-bank-options')
    expect(styles).toContain('.prep-bank-controls')
    expect(styles).toContain('.prep-bank-count-input')
  })

  it('V172-B→V19-A: new-mode cold start renders two big add cards, selected renders chips', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    // 冷启动（0 选中）：两张 prep-add-card 大卡沿用（§3.2 无 md 课次 = 从零生成引导）
    const newBasis = draft.slice(draft.indexOf("{prepMode === 'new' ? ("), draft.indexOf('<div className="prep-chat-basis">'))
    expect(newBasis).toContain('prep-add-cards')
    expect(newBasis).toContain('从外部资料添加')
    expect(newBasis).toContain('从已登记的外部资料根目录中选择文件作为生成依据')
    expect(newBasis).toContain('从素材库添加')
    expect(newBasis).toContain('从素材库挑取素材插入本课资料')
    // 有选中：chips（✕ = toggleReferenceFile）＋ 三个小入口
    expect(newBasis).toContain('selectedReferenceFileIds.length > 0 ? (')
    expect(newBasis).toContain('移除依据')
    expect(newBasis).toContain('onClick={() => toggleReferenceFile(file.id)}')
    expect(newBasis).toContain('＋ 本课资料')
    expect(styles).toContain('.prep-add-cards {')
    expect(styles).toContain('.prep-add-card {')
    expect(styles).toContain('.prep-add-card-plus {')
  })

  it('V172-C→V19-A: main empty state is a per-mode guidance card', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    // 舞台空态卡片化，分模式文案：new（从零生成）vs single/lesson（尚无方案）
    expect(draft).toContain('workspace-card draft-content-empty')
    expect(draft).toContain('还没有生成内容。右侧添加依据或直接写要求，点「✦ 发送」开始从零生成；生成后节点会出现在「修改记录」里。')
    expect(draft).toContain('还没有修改方案。右侧说清这次要改什么，点「✦ 发送」先出方案，确认后才会生成新副本。')
    expect(draft).not.toContain('左侧选择修改节点，或在上方生成新内容')
    expect(styles).toContain('.workspace-card.draft-content-empty {')
  })

  it('V172-C→V19-A: stage states replace cards without step numbers and review keeps an independent look', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const styles = source('../src/renderer/styles.css')

    // 同卡替换链条：方案（improvePhase==='review'）→ 流式（streamState）→ 成果（selectedNote）→ 对比（compareOpen）
    expect(draft.indexOf("{improvePhase === 'review' ? (")).toBeLessThan(draft.indexOf('streamState !== null ? ('))
    expect(draft.indexOf('streamState !== null ? (')).toBeLessThan(draft.indexOf('selectedNote !== undefined ? ('))
    // 舞台标题只陈述"现在是什么"：不编号、不步骤链
    expect(draft).toContain('修改方案（确认后生成）')
    expect(draft).not.toContain('改进流程')
    expect(draft).not.toContain('重新出方案')
    expect(draft).not.toContain('放弃改进')
    expect(draft).not.toContain('确认方案并生成')
    // V172-C 核查结论沿用：review 卡视觉独立（improve-plan-body 保留）
    expect(styles).toContain('.improve-plan-body {')
  })
})
