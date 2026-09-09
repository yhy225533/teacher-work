import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import type { NodeRecord, StudentRecord } from '../src/shared/core-contracts'
import DraftPanel from '../src/renderer/draft-panel'
import { createLessonPrepContext } from '../src/renderer/lesson-prep-context'

const stamp = '2026-09-01T00:00:00.000Z'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function node(id: string, kind: NodeRecord['kind'], title: string): NodeRecord {
  return { id, parentId: null, kind, title, courseMode: null, sortOrder: 0, contentMd: '', createdAt: stamp, updatedAt: stamp, deletedAt: null }
}

function prepProps(context: ReturnType<typeof createLessonPrepContext> | null): Record<string, unknown> {
  return {
    context,
    initialDraftId: null,
    onOpenDraft: vi.fn(),
    onBackToCourses: () => undefined,
    onBrowseExternal: vi.fn(),
    onBrowseMaterials: vi.fn(),
  }
}

// V19-A（D55/D56/D59）备课工作台对话式重做：对话栏 + 主舞台 + 修改记录浮层 + MdEditor 成果编辑。
describe('V19-A 对话式备课工作台', () => {
  describe('布局骨架：模式行撤除 + 对话栏 + 主舞台 + 浮层', () => {
    it('removes the mode bar and step chain while keeping prepMode contract fields', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      // 撤除项（§3.6）：prep-mode-bar、固定工作流步骤链/阶段编号、独立题库候选卡与确认条、预算长文案行
      expect(draft).not.toContain('prep-mode-bar')
      expect(draft).not.toContain('prep-mode-switch')
      expect(draft).not.toContain('improve-bank-section')
      expect(draft).not.toContain('improve-review-actions')
      expect(draft).not.toContain('这次想怎么改？')
      expect(draft).not.toContain('阶段编号')
      // 合同零改动：prepMode state、draft:generate 载荷 mode 语义、D25 确认弹窗全部保留
      expect(draft).toContain("useState<PrepLaunchMode>('new')")
      expect(draft).toContain('drafts.generate({')
      expect(draft).toContain('部分参考未完整纳入本次 AI 请求')
    })

    it('renders the page header with kicker, lesson title, history button and exit link', () => {
      const lesson = node('lesson-1', 'lesson', '有理数')
      const student: StudentRecord = { id: 'student-1', name: '张三', createdAt: stamp, updatedAt: stamp, deletedAt: null }
      const context = createLessonPrepContext(node('course-1', 'course', '初一数学'), lesson, [student], '第一阶段')
      const markup = renderToStaticMarkup(createElement(DraftPanel, prepProps(context) as never))

      // 页面头：kicker「AI 修改」+ 课次标题（阶段 · 课次）+ 修改记录浮层按钮
      expect(markup).toContain('class="section-kicker">AI 修改')
      expect(markup).toContain('第一阶段 · 有理数')
      expect(markup).toContain('🕘 修改记录 0')
      // 两栏：主舞台在前、对话栏在后（grid 顺序）
      expect(markup.indexOf('prep-main')).toBeLessThan(markup.indexOf('prep-chat'))
      expect(markup).toContain('与 AI 对话')
      expect(markup).toContain('对 AI 说')
    })
  })

  describe('对话栏：依据区 + 对 AI 说 + 发送', () => {
    it('maps 这份讲义/整个课件包 radio onto single/lesson prepMode', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      const scopeBlock = draft.slice(draft.indexOf('这次改什么'), draft.indexOf('补充参考（AI 只用来理解要求）'))
      expect(scopeBlock).toContain('这份讲义')
      expect(scopeBlock).toContain('整个课件包')
      expect(scopeBlock).toContain('checked={prepMode === \'single\'}')
      expect(scopeBlock).toContain('checked={prepMode === \'lesson\'}')
      // radio → selectChatScope → changePrepMode（映射进保留的合同字段）
      expect(draft).toContain("onChange={() => selectChatScope('single')}")
      expect(draft).toContain("onChange={() => selectChatScope('lesson')}")
    })

    it('auto-attaches the current lecture chip with 自动 badge when md exists (init effect)', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      // 初始化 effect：有 md → single + 当前讲义；无 md → new（模式行撤除后唯一的模式入口）
      const initEffect = draft.slice(
        draft.indexOf('if (!scopeInitialized.current) {'),
        draft.indexOf('knownLessonFileIds.current = currentSet'),
      ).split('\r').join('')
      expect(initEffect).toContain("aiEditableCurrentFiles.length === 0\n        ? 'new'")
      expect(initEffect).toContain("? 'lesson' : 'single'")
      expect(initEffect).toContain('requestedTarget ?? aiEditableCurrentFiles[0]')
      // single 依据区：自动徽标 + 更换入口
      expect(draft).toContain('prep-auto-badge')
      expect(draft).toContain('>自动</span>')
    })

    it('disables the send button while generating and routes by prepMode', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      // V110-C（D63）：new 模式三按钮各自直发 generate(kind)；single/lesson 保留 ✦ 发送 → startImprovePlan()
      expect(draft).toContain('void generate(kind)')
      expect(draft).toContain('void startImprovePlan()')
      expect(draft).toContain("disabled={busyAction !== '' || improveBusy || selectedFiles.length === 0}")
      // textarea 与 Skill select 生成中禁用
      expect(draft).toContain("disabled={busyAction !== '' || improveBusy} />")
      // D25 预算确认在 startImprovePlan / confirmPlanAndGenerate 两处复用（零改动）
      expect(draft).toContain('confirmReferenceBudget(baselineFiles)')
    })

    it('keeps the budget line as a single small-text row with over-budget red state', () => {
      const draft = source('../src/renderer/draft-panel.tsx')
      const styles = source('../src/renderer/styles.css')

      expect(draft).toContain('prep-chat-budget')
      expect(draft).toContain('依据与参考已用')
      expect(draft).not.toContain('prep-budget-line')
      expect(draft).not.toContain('prep-meter')
      expect(styles).toContain('.prep-chat-budget {')
      expect(styles).toContain('.prep-chat-budget.is-over {')
    })
  })

  describe('主舞台：四态同卡替换（方案/生成中/成果/对比）', () => {
    it('renders plan state with inline bank candidates and three confirm actions', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      // 方案态：方案正文 + 题库候选就地列表 + 底部三键（§3.3）
      const planStage = draft.slice(draft.indexOf('aria-label="修改方案"'), draft.indexOf('aria-label="AI 正在生成"'))
      expect(planStage).toContain('修改方案（确认后生成）')
      expect(planStage).toContain('improve-plan-body')
      expect(planStage).toContain('prep-stage-bank')
      expect(planStage).toContain('improve-bank-candidates')
      expect(planStage).toContain('✓ 确认并生成')
      expect(planStage).toContain('让 AI 调整')
      expect(planStage).toContain('放弃')
    })

    it('streams into the same stage slot with a thinking line and cancel (no card insertion)', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      // 生成态：同位置换流式正文（思考行 + 逐字正文 + 取消），不插入新卡（§3.3）
      const streamStage = draft.slice(draft.indexOf('aria-label="AI 正在生成"'), draft.indexOf('aria-label="AI 修改成果"'))
      expect(streamStage).toContain('已思考')
      expect(streamStage).toContain('已耗时')
      expect(streamStage).toContain('draft-stream-preview')
      expect(streamStage).toContain('取消生成')
      // 独立流式卡退役（draft-stream-panel 只在舞台卡内）
      expect(draft).not.toContain('draft-stream-panel')
    })

    it('renders result state with status badge, three primary actions and the ⋯ menu', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      const resultStage = draft.slice(draft.indexOf('aria-label="AI 修改成果"'), draft.indexOf('workspace-card draft-content-empty'))
      expect(resultStage).toContain("selectedNote.draftStatus === 'draft' ? '未发布' : '已确认'")
      expect(resultStage).toContain('✎ 编辑')
      expect(resultStage).toContain('⇄ 新旧对比')
      expect(resultStage).toContain('⬆ 保存为新版本')
      expect(resultStage).toContain('prep-result-menu')
      expect(resultStage).toContain('role="menu"')
      // ⋯ 菜单项：重新生成 / 保存到本次课次 / 查看课件 / 删除草稿（红区底部）
      expect(resultStage).toContain('重新生成')
      expect(resultStage).toContain('保存到本次课次')
      expect(resultStage).toContain('查看课件')
      expect(resultStage).toContain('is-danger')
      expect(resultStage).toContain('删除草稿')
      // 删除草稿仍走危险确认（deleteDraft 内 confirm destructive）
      const deleteFn = draft.slice(draft.indexOf('async function deleteDraft'), draft.indexOf('softDelete'))
      expect(deleteFn).toContain('删除未发布修改？')
      expect(deleteFn).toContain('删除后无法恢复')
      expect(deleteFn).toContain('destructive: true')
    })

    it('renders compare state as a two-pane split in the same stage card', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      expect(draft).toContain('draft-compare-grid')
      expect(draft).toContain('draft-compare-pane')
      expect(draft).toContain('参考课件：')
      expect(draft).toContain('新工作副本（未发布）')
      expect(draft).toContain('退出对比')
    })

    it('keeps the restore notice inline at the top of the result stage', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      expect(draft).toContain('draft-restore-notice')
      expect(draft).toContain('已恢复最近的工作副本：修改尚未发布，不会改变正式课件与已确认成果。')
    })
  })

  describe('修改记录浮层（D56 默认收起）', () => {
    it('opens as a drawer from the header button and loads the selected node on click', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      // 默认收起（historyOpen=false 初始态）+ 头部按钮展开 + backdrop/Esc 关闭语义
      expect(draft).toContain('const [historyOpen, setHistoryOpen] = useState(false)')
      expect(draft).toContain('onClick={() => setHistoryOpen(true)}')
      expect(draft).toContain('teaching-content-drawer-backdrop')
      expect(draft).toContain('prep-history-drawer')
      expect(draft).toContain('if (event.target === event.currentTarget) setHistoryOpen(false)')
      // 选择即加载并关闭浮层
      expect(draft).toContain('void selectResult(note); setHistoryOpen(false)')
      // 全局"修改记录"分区（DraftPanel context=null 草稿箱）不动
      expect(draft).toContain('function DraftInbox(')
      expect(draft).toContain('draft-inbox-panel')
    })
  })

  describe('MdEditor 双用法（D56）', () => {
    it('keeps the file usage on files:read-text / files:write-version (D29 zero change)', () => {
      const editor = source('../src/renderer/md-editor.tsx')
      const reader = source('../src/renderer/lesson-material-reader.tsx')

      expect(editor).toContain('window.teacherWorkbench.files.readText')
      expect(editor).toContain('window.teacherWorkbench.files.writeVersion')
      expect(editor).toContain('md-editor-draft:${file?.id')
      expect(editor).toContain('md-editor-view:${file.id}')
      expect(editor).toContain('md-editor-split:${file.id}')
      // 课件区调用零变化：仍传 file + files + onSaved + onCancel
      expect(reader).toContain('<MdEditor')
      expect(reader).toContain('file={selectedFile}')
      expect(reader).toContain('onSaved={(result)')
      expect(reader).toContain('onCancel={() => { onToggleEditing?.() }}')
    })

    it('renders the controlled usage with initialBody + onSaveBody and note-namespaced hot-draft key', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      const editorCall = draft.slice(draft.indexOf('<MdEditor'), draft.indexOf('onCancel={cancelEditing}') + 'onCancel={cancelEditing}'.length)
      expect(editorCall).toContain('initialBody={selectedNote.bodyMd}')
      expect(editorCall).toContain('storageKey={`md-editor-draft:note:${selectedNote.id}`}')
      expect(editorCall).toContain('onSaveBody=')
      expect(editorCall).toContain('onCancel={cancelEditing}')
      // 保存 = 现行 note 语义（updateNote），取消 = 丢弃编辑
      expect(editorCall).toContain('window.teacherWorkbench.core.updateNote({ noteId: selectedNote.id, bodyMd })')
      expect(draft).toContain('function cancelEditing')
      expect(draft).toContain('已取消本次未保存修改。')
    })

    it('static-renders the controlled editor without any file I/O (no readText in controlled branch)', () => {
      const editor = source('../src/renderer/md-editor.tsx')

      // 受控分支先行 return，不触碰 files:read-text；守卫拒绝双用法与空用法
      expect(editor).toContain('const isControlled = initialBody !== undefined && file === undefined')
      expect(editor).toContain('MdEditor 不允许同时提供 file 与 initialBody。')
      expect(editor).toContain('MdEditor 需要提供文件用法（file）或受控用法（initialBody + onSaveBody）。')
      // 受控保存按钮文案区分文件用法
      expect(editor).toContain("isControlled ? '保存修改' : '保存为新版本'")
    })
  })

  describe('非目标护栏（D59 不做连续聊天流）', () => {
    it('keeps one requirement textarea per send (no persisted conversation thread)', () => {
      const draft = source('../src/renderer/draft-panel.tsx')

      // 每轮产出仍是修改节点：requirement 单一状态、无对话消息数组
      expect(draft).toContain("const [requirement, setRequirement] = useState('')")
      expect(draft).not.toContain('chatMessages')
      expect(draft).not.toContain('messages.map')
      expect(draft).not.toContain('对话历史')
    })
  })
})
