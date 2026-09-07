import { toErrorMessage } from './ui-utils'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CoreOverview, NoteRecord } from '../shared/core-contracts'
import type { ManagedFileOverview, ManagedFileRecord } from '../shared/file-contracts'
import {
  DRAFT_DEFAULT_MAX_CHARS,
  DRAFT_DEFAULT_MAX_TOKENS,
  DRAFT_KINDS,
  DRAFT_MAX_REFERENCE_FILES,
  DRAFT_REQUIREMENT_MAX_CHARS,
  DRAFT_BANK_PLAN_DEFAULT_TARGET_COUNT,
  DRAFT_BANK_PLAN_MAX_TARGET_COUNT,
  DRAFT_BANK_PLAN_MIN_TARGET_COUNT,
  type DraftBankPlan,
  type DraftKind,
} from '../shared/draft-contracts'
import {
  DRAFT_BANK_CANDIDATE_MULTIPLIER,
  bankPlanToSearchRequest,
  buildBankCandidateBlock,
  fitBankCandidateCount,
  renderQuestionForContext,
} from '../shared/draft-bank-preview'
import {
  buildBankPlanPrompt,
  buildFallbackBankPlan,
  parseBankPlanText,
  DRAFT_BANK_PLAN_MAX_TOKENS,
} from '../shared/draft-bank-plan'
import type {
  QuestionBankSearchItem,
  QuestionBankSummary,
} from '../shared/question-bank-contracts'
import {
  formatExcludedReferenceNames,
  planDraftBudget,
  type DraftBudgetEntry,
} from '../shared/draft-reference-budget'
import type { SkillRecord } from '../shared/skill-contracts'
import {
  classifyLessonCoursewareFiles,
  isAiEditableFile,
  isAppGeneratedCoursewareFile,
  lessonFileSourceLabel,
  orderAiEditableFiles,
  isSelectableLessonPrepFile,
  filterLessonMaterialFiles,
  listLessonPrepFiles,
  reconcileSelectedLessonFileIds,
  type LessonPrepContext,
} from './lesson-prep-context'
import { listDraftInbox, listLessonAiResults, type DraftInboxEntry } from './draft-view-model'
import { MarkdownDocument } from './lesson-material-reader'
import MdEditor from './md-editor'
import { useAppDialog } from './app-confirm-dialog'
import { useCoreOverview } from './core-overview-provider'
import type { PrepLaunchIntent, PrepLaunchMode } from './teaching-content-context'
import {
  buildModificationScope,
  buildModeRequirement,
  buildPublishConfirmation,
  draftNoteMetadata,
  kindLabels,
  modificationNodeLabel,
  parseModificationScope,
  type ModificationMode,
} from './draft-scope'

type BusyAction = DraftKind | 'regenerate' | 'save' | 'delete' | 'publish' | ''

interface ScopedTextPart {
  readonly fileId: string
  readonly title: string
  readonly body: string
}

interface ScopedTextResult {
  readonly baselineParts: readonly ScopedTextPart[]
  readonly referenceParts: readonly ScopedTextPart[]
  readonly truncated: boolean
}

export default function DraftPanel({
  context,
  initialDraftId,
  launchIntent,
  onOpenDraft,
  onBackToCourses,
  onBrowseExternal,
  onBrowseMaterials,
  onOpenCourseware,
  onDirtyChange,
}: {
  readonly context: LessonPrepContext | null
  readonly initialDraftId: string | null
  readonly launchIntent?: PrepLaunchIntent
  readonly onOpenDraft: (context: LessonPrepContext, noteId: string) => void
  readonly onBackToCourses: () => void
  readonly onBrowseExternal: () => void
  readonly onBrowseMaterials: () => void
  readonly onOpenCourseware?: () => void
  readonly onDirtyChange?: (dirty: boolean) => void
}): React.JSX.Element {
  const { confirm } = useAppDialog()
  const { overview: core, error: coreLoadError, reload: reloadSharedOverview, clearError: clearCoreError } = useCoreOverview()
  const [files, setFiles] = useState<ManagedFileOverview | null>(null)
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  const [prepMode, setPrepMode] = useState<PrepLaunchMode>('new')
  const [targetFileId, setTargetFileId] = useState('')
  const [lessonBaselineFileIds, setLessonBaselineFileIds] = useState<string[]>([])
  const [selectedReferenceFileIds, setSelectedReferenceFileIds] = useState<string[]>([])
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [requirement, setRequirement] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [busyAction, setBusyAction] = useState<BusyAction>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [restoreNoticeVisible, setRestoreNoticeVisible] = useState(false)
  // V19-A（D55）：修改记录默认收起为顶部浮层按钮；成果操作低频项收进 ⋯ 菜单
  const [historyOpen, setHistoryOpen] = useState(false)
  const [resultMenuOpen, setResultMenuOpen] = useState(false)
  const [improvePhase, setImprovePhase] = useState<'' | 'review'>('')
  const [improvePlan, setImprovePlan] = useState('')
  const [improveBusy, setImproveBusy] = useState(false)
  const [improveError, setImproveError] = useState('')
  const [improveBase, setImproveBase] = useState<{ title: string; body: string } | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [improveKind, setImproveKind] = useState<DraftKind>('lecture')
  // D30/V17-D：题库自动选题（开关 + 过目步状态）
  const [bankSummary, setBankSummary] = useState<QuestionBankSummary | null>(null)
  const [bankEnabled, setBankEnabled] = useState(false)
  const [bankTargetCount, setBankTargetCount] = useState(DRAFT_BANK_PLAN_DEFAULT_TARGET_COUNT)
  const [dualVersionEnabled, setDualVersionEnabled] = useState(false)
  const [bankPlan, setBankPlan] = useState<DraftBankPlan | null>(null)
  const [bankCandidates, setBankCandidates] = useState<readonly QuestionBankSearchItem[]>([])
  const [bankExcludedIds, setBankExcludedIds] = useState<string[]>([])
  const [bankRenderedMap, setBankRenderedMap] = useState<ReadonlyMap<string, string>>(new Map())
  const [bankAdjustment, setBankAdjustment] = useState('')
  const [bankNotice, setBankNotice] = useState('')
  const [bankPlanBusy, setBankPlanBusy] = useState(false)
  const [referenceCharCounts, setReferenceCharCounts] = useState<ReadonlyMap<string, number>>(new Map())
  const [streamState, setStreamState] = useState<{
    readonly phase: 'reasoning' | 'text'
    readonly reasoningChars: number
    readonly textPreview: string
    readonly requestId: string
    readonly startedAt: number
  } | null>(null)
  // 思考阶段的"已耗时"走本地秒表：流事件只在网络 chunk 到达时触发，
  // 推理模型可能数十秒无事件，纯事件驱动计数会长时间静止。
  const [streamElapsedSeconds, setStreamElapsedSeconds] = useState(0)
  const streamRequestId = useRef('')
  const [referenceNotice, setReferenceNotice] = useState('')
  const confirmedBudgetSignature = useRef('')
  const knownLessonFileIds = useRef<Set<string>>(new Set())
  const scopeInitialized = useRef(false)
  // V19-A（D55）：对话栏折叠态（窄窗堆叠时的摘要条）；依据区 scope radio 收起态（规则随 V172-A 更换列表同构）
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [scopePickerOpen, setScopePickerOpen] = useState(false)
  const [refPickerOpen, setRefPickerOpen] = useState(false)

  const lessonFiles = useMemo(() => {
    if (files === null || context === null) return []
    return filterLessonMaterialFiles(listLessonPrepFiles(files, context.lessonId), {
      lessonLabel: context.lessonLabel,
      periodTitle: context.periodTitle,
    })
  }, [context, files])
  const lessonFileKey = lessonFiles.map((file) => file.id).join('|')
  const classifiedFiles = useMemo(() => classifyLessonCoursewareFiles(lessonFiles), [lessonFiles])
  const selectableLessonFiles = lessonFiles.filter(isSelectableLessonPrepFile)
  const selectableCurrentFiles = classifiedFiles.currentMaterials.filter(isSelectableLessonPrepFile)
  const appGeneratedCurrentFiles = selectableCurrentFiles.filter(isAppGeneratedCoursewareFile)
  const aiEditableCurrentFiles = orderAiEditableFiles(selectableCurrentFiles.filter(isAiEditableFile))
  const targetFile = selectableLessonFiles.find((file) => file.id === targetFileId) ?? null
  const lessonBaselineFiles = lessonBaselineFileIds
    .map((fileId) => selectableLessonFiles.find((file) => file.id === fileId))
    .filter((file): file is ManagedFileRecord => file !== undefined)
  // D27（V17-B）：单文件修改候选 = 课次全部 md（版本链最新版优先），非 md 不列。
  const modifiableCurrentFiles = prepMode === 'single'
    ? aiEditableCurrentFiles
    : selectableCurrentFiles
  const referenceCandidates = prepMode === 'single'
    ? selectableCurrentFiles.filter((file) => file.id !== targetFile?.id)
    : prepMode === 'lesson'
      ? selectableCurrentFiles.filter((file) => !lessonBaselineFiles.some((base) => base.id === file.id))
      : selectableCurrentFiles
  const selectedReferenceFiles = referenceCandidates.filter((file) => selectedReferenceFileIds.includes(file.id))
  const referenceCandidatesKey = referenceCandidates.map((file) => file.id).join('|')
  const referenceCharTotal = selectedReferenceFiles.reduce(
    (sum, file) => sum + (referenceCharCounts.get(file.id) ?? 0),
    0,
  )
  const referenceFilesFull = selectedReferenceFiles.length >= DRAFT_MAX_REFERENCE_FILES
  const baselineCharTotal = prepMode === 'single'
    ? referenceCharCounts.get(targetFile?.id ?? '') ?? 0
    : lessonBaselineFiles.reduce((sum, file) => sum + (referenceCharCounts.get(file.id) ?? 0), 0)
  const scopedCharTotal = baselineCharTotal + referenceCharTotal
  const referenceBudgetExceeded = scopedCharTotal > DRAFT_DEFAULT_MAX_CHARS
  // D30：过目步剔除后的候选集（确认生成按此集合发送，Main 不再自行检索）
  const keptBankCandidates = bankCandidates.filter((item) => !bankExcludedIds.includes(item.id))
  const keptBankRendereds = keptBankCandidates.map(
    (item) => bankRenderedMap.get(item.id) ?? item.contentPreview,
  )
  const bankCandidateChars = keptBankRendereds.length === 0
    ? 0
    : buildBankCandidateBlock(keptBankRendereds, keptBankRendereds.length).length
  const selectedFiles = uniqueFiles(prepMode === 'single'
    ? [...(targetFile === null ? [] : [targetFile]), ...selectedReferenceFiles]
    : prepMode === 'lesson'
      ? [...lessonBaselineFiles, ...selectedReferenceFiles]
      : selectedReferenceFiles)
  const plannedDraftKind = prepMode === 'lesson'
    ? DRAFT_KINDS.lecture
    : prepMode === 'single'
      ? inferDraftKind(targetFile)
      : improveKind
  const lessonResults = useMemo(
    () => context === null ? [] : listLessonAiResults(core, context.lessonId),
    [context, core],
  )
  const selectedNote = selectedNoteId === null
    ? undefined
    : lessonResults.find((note) => note.id === selectedNoteId)
  const selectedVariant = selectedNote === undefined ? undefined : draftNoteMetadata(selectedNote)?.variant
  const dirty = editing && selectedNote !== undefined && editBody !== selectedNote.bodyMd

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => { clearCoreError() }, [clearCoreError])

  // D30/V17-D：题库安装状态只读探测（未安装时开关置灰并提示导入）。
  useEffect(() => {
    let cancelled = false
    void window.teacherWorkbench.questionBank.getSummary()
      .then((summary) => { if (!cancelled) setBankSummary(summary) })
      .catch(() => { if (!cancelled) setBankSummary(null) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    knownLessonFileIds.current = new Set()
    scopeInitialized.current = false
    setPrepMode(launchIntent?.mode ?? 'new')
    setTargetFileId(launchIntent?.targetFileId ?? '')
    setLessonBaselineFileIds([])
    setSelectedReferenceFileIds([])
    setSelectedSkillId('')
    setRequirement('')
    setSelectedNoteId(initialDraftId)
    setShowResults(initialDraftId !== null)
    setEditing(false)
    setEditBody('')
    setMessage('')
    setError('')
    setRestoreNoticeVisible(false)
    setImprovePhase('')
    setImprovePlan('')
    setImproveError('')
    setImproveBase(null)
    setCompareOpen(false)
    setReferenceNotice('')
    setHistoryOpen(false)
    setResultMenuOpen(false)
    setChatCollapsed(false)
    setScopePickerOpen(false)
    setRefPickerOpen(false)
    void (async () => {
      const loadedCore = await reload()
      if (cancelled || context === null || loadedCore === null) return
      if (initialDraftId !== null) {
        setRestoreNoticeVisible(true)
        return
      }
      if (launchIntent !== undefined) return
      const latestDraft = listLessonAiResults(loadedCore, context.lessonId)
        .find((note) => note.draftStatus === 'draft')
      if (latestDraft === undefined) return
      setSelectedNoteId(latestDraft.id)
      setShowResults(true)
      setRestoreNoticeVisible(true)
    })()
    return () => { cancelled = true }
  }, [context?.lessonId, initialDraftId, launchIntent?.mode, launchIntent?.targetFileId])

  useEffect(() => {
    if (files === null) return
    const currentSet = new Set(lessonFiles.map((file) => file.id))
    const previousKnown = knownLessonFileIds.current
    if (!scopeInitialized.current) {
      const requestedMode = launchIntent?.mode
      const nextMode: PrepLaunchMode = aiEditableCurrentFiles.length === 0
        ? 'new'
        : requestedMode === 'lesson' && appGeneratedCurrentFiles.length > 0 ? 'lesson' : 'single'
      const requestedTarget = aiEditableCurrentFiles.find((file) => file.id === launchIntent?.targetFileId)
      const nextTarget = requestedTarget ?? aiEditableCurrentFiles[0]
      setPrepMode(nextMode)
      setTargetFileId(nextTarget?.id ?? '')
      setLessonBaselineFileIds(nextMode === 'lesson'
        ? appGeneratedCurrentFiles.map((file) => file.id)
        : [])
      setSelectedReferenceFileIds(nextMode === 'new' ? selectableCurrentFiles.map((file) => file.id) : [])
      knownLessonFileIds.current = currentSet
      scopeInitialized.current = true
      return
    }
    setSelectedReferenceFileIds((current) =>
      reconcileSelectedLessonFileIds(current, previousKnown, lessonFiles),
    )
    knownLessonFileIds.current = currentSet
  }, [files, lessonFileKey, launchIntent?.mode, launchIntent?.targetFileId])

  useEffect(() => {
    if (!showResults) return
    if (selectedNoteId !== null) return
    setSelectedNoteId(lessonResults[0]?.id ?? null)
    setEditing(false)
    setEditBody('')
  }, [lessonResults, selectedNoteId, showResults])

  // V19-A（D55）：进入页面按课次状态自动初始化（有 md → single + 当前讲义；无 → new）；
  // 模式切换器已撤除，"整个课件包"经依据区 radio 映射 lesson。选中节点只关浮层，对话栏常驻可改要求。
  useEffect(() => {
    setResultMenuOpen(false)
  }, [selectedNoteId])

  useEffect(() => {
    let cancelled = false
    if (files === null || selectedNote === undefined) return
    const scope = parseModificationScope(selectedNote)
    const selectedDraftMetadata = draftNoteMetadata(selectedNote)
    if (scope === null || selectedDraftMetadata === null) return

    const orderedSourceIds = uniqueStrings(selectedDraftMetadata.sources.map((source) => source.fileId))
    const baselineIds = orderedSourceIds.slice(0, scope.baselineCount)
    const referenceIds = orderedSourceIds.slice(scope.baselineCount)
    const baselineFiles = baselineIds
      .map((fileId) => lessonFiles.find((file) => file.id === fileId))
      .filter((file): file is ManagedFileRecord => file !== undefined && isSelectableLessonPrepFile(file))

    setPrepMode(scope.mode)
    setTargetFileId(scope.mode === 'single' ? baselineIds[0] ?? '' : '')
    setLessonBaselineFileIds(scope.mode === 'lesson' ? baselineIds : [])
    setSelectedReferenceFileIds(referenceIds)
    setSelectedSkillId(selectedDraftMetadata.skill?.id ?? '')
    setRequirement(scope.teacherRequirement)
    setImprovePhase('')
    setImprovePlan('')
    setImproveError('')
    setCompareOpen(false)

    void (async () => {
      const scopedText = await readScopedTextParts(baselineFiles, [], DRAFT_DEFAULT_MAX_CHARS)
      if (cancelled) return
      setImproveBase(buildComparisonBase(scope.mode, scopedText.baselineParts))
    })().catch((restoreError: unknown) => {
      if (cancelled) return
      setImproveBase(null)
      setImproveError(`原始对比内容暂时无法恢复：${toErrorMessage(restoreError, '操作失败，请稍后重试。')}`)
    })

    return () => { cancelled = true }
  }, [files, lessonFileKey, selectedNote?.id])

  // D25：选择区实时显示每份候选参考的字符数与累计占用；readContent 顺序读、小文件成本可接受。
  useEffect(() => {
    let cancelled = false
    if (files === null) return
    const targets = prepMode === 'single'
      ? [...(targetFile === null ? [] : [targetFile]), ...referenceCandidates]
      : [...lessonBaselineFiles, ...referenceCandidates]
    void (async () => {
      const counts = new Map<string, number>()
      for (const file of targets) {
        try {
          const content = await window.teacherWorkbench.files.readContent({ fileId: file.id })
          if (cancelled) return
          if (content.kind === 'text') counts.set(file.id, content.content.length)
        } catch {
          if (cancelled) return
        }
      }
      if (cancelled) return
      setReferenceCharCounts(new Map(counts))
    })()
    return () => { cancelled = true }
  }, [files, lessonFileKey, prepMode, targetFileId, lessonBaselineFileIds.length, referenceCandidatesKey])

  useEffect(() => {
    confirmedBudgetSignature.current = ''
  }, [selectedReferenceFileIds, targetFileId, lessonBaselineFileIds])

  // D22：订阅流事件（按 requestId 过滤）——reasoning 只累计进度计数（不展示思维链原文），text 逐字上屏。
  useEffect(() => window.teacherWorkbench.ai.onStreamEvent((event) => {
    if (event.requestId !== streamRequestId.current) return
    if (event.kind === 'reasoning') {
      setStreamState((current) => current === null
        ? current
        : { ...current, phase: 'reasoning', reasoningChars: event.chars ?? current.reasoningChars })
      return
    }
    if (event.kind === 'text' && event.text !== undefined) {
      setStreamState((current) => current === null
        ? current
        : { ...current, phase: 'text', textPreview: current.textPreview + event.text })
    }
  }), [])

  function beginStreaming(requestId: string): void {
    streamRequestId.current = requestId
    setStreamElapsedSeconds(0)
    setStreamState({ phase: 'reasoning', reasoningChars: 0, textPreview: '', requestId, startedAt: Date.now() })
  }

  function endStreaming(): void {
    streamRequestId.current = ''
    setStreamState(null)
  }

  // 流式面板显示期间每秒推进本地秒表；面板隐藏或组件卸载时停止。
  useEffect(() => {
    if (streamState === null) return
    const timer = setInterval(() => {
      setStreamElapsedSeconds(Math.max(0, Math.floor((Date.now() - streamState.startedAt) / 1000)))
    }, 1000)
    return () => clearInterval(timer)
  }, [streamState === null, streamState?.startedAt])

  async function cancelStreaming(): Promise<void> {
    if (streamState === null) return
    await window.teacherWorkbench.ai.cancel({ requestId: streamState.requestId }).catch(() => undefined)
  }

  async function reload(): Promise<CoreOverview | null> {
    try {
      const [nextFiles, nextSkills, nextCore] = await Promise.all([
        window.teacherWorkbench.files.getOverview(),
        window.teacherWorkbench.skills.list(),
        reloadSharedOverview(),
      ])
      setFiles(nextFiles)
      setSkills(nextSkills)
      setError('')
      return nextCore
    } catch (loadError) {
      setError(toErrorMessage(loadError, '操作失败，请稍后重试。'))
      return null
    }
  }

  function toggleReferenceFile(fileId: string): void {
    const file = referenceCandidates.find((candidate) => candidate.id === fileId)
    if (file === undefined) return
    setSelectedReferenceFileIds((current) => {
      if (current.includes(fileId)) return current.filter((id) => id !== fileId)
      // D25：补充参考最多 10 份，超限禁止继续勾选并提示。
      if (current.length >= DRAFT_MAX_REFERENCE_FILES) {
        setReferenceNotice(`补充参考最多选择 ${DRAFT_MAX_REFERENCE_FILES} 份，请先取消一份再勾选。`)
        return current
      }
      setReferenceNotice('')
      return [...current, fileId]
    })
  }

  function selectTargetFile(fileId: string): void {
    if (!modifiableCurrentFiles.some((file) => file.id === fileId)) return
    setTargetFileId(fileId)
    setSelectedReferenceFileIds((current) => current.filter((id) => id !== fileId))
    setScopePickerOpen(false)
    setImprovePhase('')
    setImprovePlan('')
    setImproveError('')
    setImproveBase(null)
    setCompareOpen(false)
    clearBankSelection()
    setMessage('')
  }

  /** V19-A（D55）：依据区「这次改什么」radio——这份讲义(single) ｜ 整个课件包(lesson)，映射进保留的 prepMode 合同字段。 */
  function selectChatScope(nextMode: Exclude<PrepLaunchMode, 'new'>): void {
    changePrepMode(nextMode)
  }

  function changePrepMode(nextMode: Exclude<PrepLaunchMode, 'new'>): void {
    // D27：单文件模式只需课次内存在 md；整课重做沿用应用内课件版本基线（V17-B 不动）。
    const modeAvailable = nextMode === 'single'
      ? aiEditableCurrentFiles.length > 0
      : appGeneratedCurrentFiles.length > 0
    if (!modeAvailable || prepMode === nextMode) return
    setPrepMode(nextMode)
    if (nextMode === 'single' && !modifiableCurrentFiles.some((file) => file.id === targetFileId)) {
      setTargetFileId(classifiedFiles.currentVersion?.id ?? modifiableCurrentFiles[0]?.id ?? '')
    }
    if (nextMode === 'lesson') {
      setLessonBaselineFileIds(appGeneratedCurrentFiles.map((file) => file.id))
    }
    setSelectedReferenceFileIds([])
    setReferenceNotice('')
    setScopePickerOpen(false)
    setImprovePhase('')
    setImprovePlan('')
    setImproveError('')
    setImproveBase(null)
    setCompareOpen(false)
    clearBankSelection()
    setMessage('')
  }

  async function generate(kind: DraftKind): Promise<void> {
    if (context === null || selectedFiles.length === 0) {
      setError('请先从本次课次资料中选择至少一份资料。')
      return
    }
    setBusyAction(kind)
    const requestId = globalThis.crypto.randomUUID()
    setError('')
    try {
      // D30/V17-D：新建备课同样有过目步——开关开启且尚无候选时先出检索计划与候选列表，
      // 老师过目（可剔除/调整重选）后再点一次生成按钮执行。
      if (bankEnabled && bankPlan === null) {
        const ready = await runBankSelection(requestId)
        if (!ready) return
        setBusyAction('')
        setMessage('题库候选已列出，请过目（可剔除或调整后重新选题），再点一次生成按钮执行。')
        return
      }
      if (bankEnabled && bankPlan !== null && keptBankCandidates.length === 0) {
        setError('候选题已被全部剔除，请保留至少一道候选题或关闭参考题库。')
        return
      }
      const bankActive = bankEnabled && bankPlan !== null
      setMessage(`正在生成${kindLabels[kind]}…`)
      beginStreaming(requestId)
      const result = await window.teacherWorkbench.drafts.generate({
        requestId,
        kind,
        lessonId: context.lessonId,
        ...(context.studentId === undefined ? {} : { studentId: context.studentId }),
        ...(selectedSkillId === '' ? {} : { skillId: selectedSkillId }),
        ...(requirement.trim() === '' ? {} : { requirement: requirement.trim() }),
        ...(bankActive ? {
          bankPlan: bankPlan,
          bankQuestionIds: keptBankCandidates.map((item) => item.id),
        } : {}),
        ...(bankActive && dualVersionEnabled ? { dualVersion: true } : {}),
        sources: selectedFiles.map((file) => ({ fileId: file.id })),
        maxChars: DRAFT_DEFAULT_MAX_CHARS,
        maxTokens: DRAFT_DEFAULT_MAX_TOKENS,
      })
      await reload()
      setSelectedNoteId(result.noteId)
      setShowResults(true)
      setRestoreNoticeVisible(false)
      setEditing(false)
      setEditBody('')
      clearBankSelection()
      setMessage(`已生成，可在修改记录中查看。${result.studentNoteId !== undefined ? '学生版已一并生成，见修改记录。' : ''}`)
    } catch (generationError) {
      setMessage('')
      setError(toErrorMessage(generationError, '操作失败，请稍后重试。'))
    } finally {
      endStreaming()
      setBusyAction('')
    }
  }

  function buildBudgetEntries(files: readonly ManagedFileRecord[]): DraftBudgetEntry[] {
    return files.flatMap((file) => {
      const chars = referenceCharCounts.get(file.id)
      return chars === undefined ? [] : [{ fileId: file.id, title: file.originalName, chars }]
    })
  }

  /** D25：发起前预算检查——预算耗尽时明确列出未纳入/未完整纳入的参考，需老师确认继续或删减（同一确认在方案与确认生成间复用）。 */
  async function confirmReferenceBudget(baselineFiles: readonly ManagedFileRecord[]): Promise<boolean> {
    const baseline = buildBudgetEntries(baselineFiles)
    const references = buildBudgetEntries(selectedReferenceFiles)
    const plan = planDraftBudget(baseline, references, DRAFT_DEFAULT_MAX_CHARS)
    const unmeasuredCount = selectedReferenceFiles.filter(
      (file) => !referenceCharCounts.has(file.id),
    ).length
    const overflowCount = plan.excludedReferences.length
    // D30：题库候选块整块计入预算——文件参考优先，候选块按同一截减算法取“部分纳入 M 道”
    const bankActive = bankEnabled && bankPlan !== null && keptBankCandidates.length > 0
    const bankRemaining = Math.max(0, DRAFT_DEFAULT_MAX_CHARS - scopedCharTotal)
    const bankFitCount = bankActive
      ? fitBankCandidateCount(keptBankRendereds, bankPlan.targetCount, bankRemaining)
      : 0
    const bankOverflow = bankActive && bankCandidateChars > bankRemaining && bankFitCount > 0
    if (overflowCount === 0 && unmeasuredCount === 0 && !bankOverflow) return true
    const signature = `${baselineFiles.map((file) => file.id).join(',')}#${selectedReferenceFiles.map((file) => file.id).join(',')}:${overflowCount}:${bankCandidateChars}`
    if (signature === confirmedBudgetSignature.current) return true
    const overflowNames = overflowCount > 0
      ? `按 ${DRAFT_DEFAULT_MAX_CHARS} 字预算，以下参考未纳入或未完整纳入：${formatExcludedReferenceNames(plan.excludedReferences)}。`
      : ''
    const unmeasuredHint = unmeasuredCount > 0
      ? `${unmeasuredCount} 份参考（如 Office/PDF）无法预读字符数，实际发送时按解析文本优先计入。`
      : ''
    const bankHint = bankOverflow
      ? `题库候选 ${keptBankCandidates.length} 道（按预算部分纳入 ${bankFitCount} 道）。`
      : ''
    const hints = [overflowNames, unmeasuredHint, bankHint].filter((hint) => hint !== '')
    const confirmed = await confirm({
      title: '部分参考未完整纳入本次 AI 请求',
      description: <>{hints.join(' ')}<br />可以继续生成，也可以返回取消勾选或删减候选。</>,
      confirmLabel: '继续生成',
    })
    if (!confirmed) return false
    confirmedBudgetSignature.current = signature
    return true
  }

  function toggleBankEnabled(): void {
    if (bankSummary !== null && !bankSummary.installed) return
    setBankEnabled((current) => {
      if (current) {
        // 关闭开关即作废过目步状态；确认生成回到无题库请求
        setBankPlan(null)
        setBankCandidates([])
        setBankExcludedIds([])
        setBankRenderedMap(new Map())
        setBankNotice('')
      }
      return !current
    })
  }

  function clearBankSelection(): void {
    setBankPlan(null)
    setBankCandidates([])
    setBankExcludedIds([])
    setBankRenderedMap(new Map())
    setBankNotice('')
  }

  function toggleBankCandidate(questionId: string): void {
    setBankExcludedIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    )
  }

  /**
   * D30 过目步阶段一+二：AI 出检索计划（容错回退）→ question-bank:search-questions
   * 本地检索 → 逐题取详情算候选块字数（与 Main 注入共用同一渲染函数）。返回是否拿到候选。
   */
  async function runBankSelection(requestIdSeed: string, extraRequirement?: string): Promise<boolean> {
    if (context === null) return false
    setBankPlanBusy(true)
    setBankNotice('')
    try {
      const summary = await window.teacherWorkbench.questionBank.getSummary()
      setBankSummary(summary)
      if (!summary.installed) {
        setBankNotice('题库未安装，请先在题库页导入 .tqbank。')
        return false
      }
      const combinedRequirement = [requirement.trim(), (extraRequirement ?? '').trim()]
        .filter((part) => part !== '')
        .join('\n')
      const fallback = buildFallbackBankPlan({
        lessonTitle: context.lessonTitle,
        ...(combinedRequirement === '' ? {} : { requirement: combinedRequirement }),
        summary,
        targetCount: bankTargetCount,
      })
      const result = await window.teacherWorkbench.ai.requestText({
        requestId: `${requestIdSeed}-bank-plan`,
        prompt: buildBankPlanPrompt({
          lessonTitle: context.lessonTitle,
          ...(context.periodTitle === undefined ? {} : { periodTitle: context.periodTitle }),
          ...(combinedRequirement === '' ? {} : { requirement: combinedRequirement }),
          summary,
          targetCount: bankTargetCount,
        }),
        maxTokens: DRAFT_BANK_PLAN_MAX_TOKENS,
      })
      const plan = parseBankPlanText(result.text, fallback)
      const retrieved = await window.teacherWorkbench.questionBank.searchQuestions({
        ...bankPlanToSearchRequest(plan),
        limit: Math.min(plan.targetCount * DRAFT_BANK_CANDIDATE_MULTIPLIER, 100),
        offset: 0,
      })
      if (retrieved.items.length === 0) {
        setBankNotice('题库中没有符合检索计划的题目，请调整要求重新选题或关闭参考题库。')
        return false
      }
      const rendereds = new Map<string, string>()
      for (const item of retrieved.items) {
        try {
          const detail = await window.teacherWorkbench.questionBank.getQuestion({ questionId: item.id })
          rendereds.set(item.id, renderQuestionForContext(detail))
        } catch {
          if (!rendereds.has(item.id)) rendereds.set(item.id, item.contentPreview)
        }
      }
      setBankPlan(plan)
      setBankCandidates(retrieved.items)
      setBankExcludedIds([])
      setBankRenderedMap(rendereds)
      return true
    } catch (bankError) {
      setBankNotice(toErrorMessage(bankError, '题库选题失败，请稍后重试；或关闭参考题库直接生成。'))
      return false
    } finally {
      setBankPlanBusy(false)
    }
  }

  /** D30 过目步反馈：自然语言调整追加进 requirement，重新出检索计划并重检索。 */
  async function reselectBank(): Promise<void> {
    const adjustment = bankAdjustment.trim()
    if (adjustment !== '') {
      setRequirement((current) =>
        [current.trim(), adjustment].filter((part) => part !== '').join('\n'))
    }
    setBankAdjustment('')
    await runBankSelection(globalThis.crypto.randomUUID(), adjustment)
  }

  async function startImprovePlan(): Promise<void> {
    if (prepMode === 'new') return
    const baselineFiles = prepMode === 'single'
      ? targetFile === null ? [] : [targetFile]
      : lessonBaselineFiles
    if (baselineFiles.length === 0) {
      setImproveError(prepMode === 'single' ? '请先选择要修改的文件。' : '本课没有可用于整课重做的基线内容。')
      return
    }
    if (requirement.trim() === '') {
      setImproveError('请先填写本次修改要求，AI 需要知道你想怎么改。')
      return
    }
    if (!await confirmReferenceBudget(baselineFiles)) {
      setImproveError('已取消。请删减补充参考后重试，或再次发起并选择“继续生成”。')
      return
    }
    const planRequestId = globalThis.crypto.randomUUID()
    setImproveBusy(true)
    setImproveError('')
    setMessage('正在生成修改方案…')
    beginStreaming(planRequestId)
    try {
      const scopedText = await readScopedTextParts(
        baselineFiles,
        selectedReferenceFiles,
        DRAFT_DEFAULT_MAX_CHARS,
      )
      if (scopedText.baselineParts.length === 0) {
        setImproveError(prepMode === 'single'
          ? '修改对象没有可读文本，无法生成修改方案。'
          : '本课基线没有可读文本，无法生成整课重做方案。')
        setMessage('')
        return
      }
      const prompt = buildPlanPrompt(prepMode, requirement.trim(), scopedText)
      const result = await window.teacherWorkbench.ai.requestText({
        requestId: planRequestId,
        prompt,
        maxTokens: DRAFT_DEFAULT_MAX_TOKENS,
        stream: true,
      })
      setImprovePlan(result.text)
      setImproveBase(buildComparisonBase(prepMode, scopedText.baselineParts))
      // D30 过目步：方案阶段同时执行阶段一（AI 检索计划）+ 阶段二（本地候选检索），串行秒级
      if (bankEnabled) {
        setMessage('正在按课次要求检索题库候选题…')
        await runBankSelection(planRequestId)
      }
      setImprovePhase('review')
      setMessage(prepMode === 'single'
        ? '单文件修改方案已生成，请审阅确认后再生成新副本。'
        : '整课重做方案已生成，请审阅确认后再生成完整新版本。')
    } catch (planError) {
      setMessage('')
      setImproveError(toErrorMessage(planError, '操作失败，请稍后重试。'))
    } finally {
      endStreaming()
      setImproveBusy(false)
    }
  }

  async function confirmPlanAndGenerate(kind: DraftKind): Promise<void> {
    if (context === null || improvePlan.trim() === '' || prepMode === 'new') return
    const baselineFiles = prepMode === 'single'
      ? targetFile === null ? [] : [targetFile]
      : lessonBaselineFiles
    if (baselineFiles.length === 0) {
      setImproveError('修改对象或整课基线已变化，请重新发起修改。')
      return
    }
    if (!await confirmReferenceBudget(baselineFiles)) {
      setImproveError('已取消。请删减补充参考后重试，或再次确认并选择“继续生成”。')
      return
    }
    // D30 过目步：开启题库但候选被全部剔除时阻止生成（保留全部或关闭开关）
    const bankActive = bankEnabled && bankPlan !== null
    if (bankActive && keptBankCandidates.length === 0) {
      setImproveError('候选题已被全部剔除，请保留至少一道候选题或关闭参考题库。')
      return
    }
    const orderedSources = uniqueFiles([...baselineFiles, ...selectedReferenceFiles])
    const generatedKind = prepMode === 'lesson' ? DRAFT_KINDS.lecture : kind
    const streamRequestId = globalThis.crypto.randomUUID()
    setImproveBusy(true)
    setImproveError('')
    setMessage(prepMode === 'single'
      ? `正在按确认的方案修订《${baselineFiles[0].originalName}》…`
      : '正在按确认的方案重做整课课件…')
    beginStreaming(streamRequestId)
    try {
      const teacherRequirement = requirement.trim()
      const confirmedPlan = improvePlan.trim()
      const embeddedRequirement = buildModeRequirement(
        prepMode,
        baselineFiles[0],
        baselineFiles.length,
        teacherRequirement,
        confirmedPlan,
      )
      const modification = buildModificationScope(
        prepMode,
        prepMode === 'single' ? baselineFiles[0] : null,
        baselineFiles.length,
        teacherRequirement,
        confirmedPlan,
      )
      const result = await window.teacherWorkbench.drafts.generate({
        requestId: streamRequestId,
        kind: generatedKind,
        lessonId: context.lessonId,
        ...(context.studentId === undefined ? {} : { studentId: context.studentId }),
        ...(selectedSkillId === '' ? {} : { skillId: selectedSkillId }),
        requirement: embeddedRequirement,
        modification,
        // D30/D31：确认请求固化过目步剔除后的候选集 + 学生版开关；题库未出计划时按无题库生成
        ...(bankActive ? {
          bankPlan: bankPlan,
          bankQuestionIds: keptBankCandidates.map((item) => item.id),
        } : {}),
        ...(bankActive && dualVersionEnabled ? { dualVersion: true } : {}),
        sources: orderedSources.map((file) => ({ fileId: file.id })),
        maxChars: DRAFT_DEFAULT_MAX_CHARS,
        maxTokens: DRAFT_DEFAULT_MAX_TOKENS,
      })
      await reload()
      setSelectedNoteId(result.noteId)
      setShowResults(true)
      setRestoreNoticeVisible(false)
      setEditing(false)
      setEditBody('')
      setCompareOpen(true)
      setImprovePhase('')
      setImprovePlan('')
      clearBankSelection()
      setMessage(prepMode === 'single'
        ? `《${baselineFiles[0].originalName}》已按方案生成完整修订稿，可用“新旧对比”查看差异。${result.studentNoteId !== undefined ? '学生版已一并生成，见修改记录。' : ''}`
        : `整课完整新版本已生成，包含讲义、例题、课堂练习与课后作业，可用“新旧对比”审阅。${result.studentNoteId !== undefined ? '学生版已一并生成，见修改记录。' : ''}`)
    } catch (generationError) {
      setMessage('')
      setImproveError(toErrorMessage(generationError, '操作失败，请稍后重试。'))
    } finally {
      endStreaming()
      setImproveBusy(false)
    }
  }

  async function publishVersion(): Promise<void> {
    if (selectedNote === undefined) return
    if (!await confirm({
      title: '保存为新版本？',
      description: buildPublishConfirmation(selectedNote),
      confirmLabel: '保存为新版本',
    })) return
    setBusyAction('publish')
    setMessage('')
    setError('')
    try {
      const result = await window.teacherWorkbench.drafts.publishToLesson({
        requestId: globalThis.crypto.randomUUID(),
        noteId: selectedNote.id,
      })
      await reload()
      setMessage(`已发布为课件《${result.file.originalName}》（第 ${result.version} 版），旧版本保留，可在课件区查看。`)
    } catch (publishError) {
      setError(toErrorMessage(publishError, '操作失败，请稍后重试。'))
    } finally {
      setBusyAction('')
    }
  }

  function abandonImprove(): void {
    setImprovePhase('')
    setImprovePlan('')
    setImproveError('')
    setMessage('')
  }

  async function selectResult(note: NoteRecord): Promise<void> {
    if (dirty && !await confirm({
      title: '切换修改记录？',
      description: '当前修改尚未保存，切换后将丢失本次编辑。',
      confirmLabel: '继续切换',
      destructive: true,
    })) return
    setRestoreNoticeVisible(false)
    setSelectedNoteId(note.id)
    setEditing(false)
    setEditBody('')
    setImprovePhase('')
    setImprovePlan('')
    setImproveError('')
    setImproveBase(null)
    setCompareOpen(false)
    setMessage('')
    setError('')
  }

  function startEditing(): void {
    if (selectedNote === undefined) return
    setEditing(true)
    setMessage('')
    setError('')
  }

  function cancelEditing(): void {
    setEditing(false)
    setEditBody('')
    setMessage('已取消本次未保存修改。')
    setError('')
  }

  async function saveModification(): Promise<void> {
    if (selectedNote === undefined || editBody.trim() === '') {
      setError('草稿内容不能为空。')
      return
    }
    setBusyAction('save')
    setError('')
    try {
      // V19-A（D56）：编辑态正文由 MdEditor 受控用法持有，saveModification 保留为
      // 舞台头「保存修改」入口与编辑器主按钮共用语义（updateNote = note 生命周期零改动）
      await window.teacherWorkbench.core.updateNote({ noteId: selectedNote.id, bodyMd: editBody })
      setEditing(false)
      setEditBody('')
      setMessage('修改已保存。')
      await reload()
    } catch (saveError) {
      setError(toErrorMessage(saveError, '操作失败，请稍后重试。'))
    } finally {
      setBusyAction('')
    }
  }

  async function saveToLesson(): Promise<void> {
    if (selectedNote === undefined) return
    if (editing && editBody.trim() === '') {
      setError('草稿内容不能为空。')
      return
    }
    setBusyAction('save')
    setError('')
    try {
      await window.teacherWorkbench.drafts.saveToLesson({
        noteId: selectedNote.id,
        ...(editing ? { bodyMd: editBody } : {}),
      })
      setEditing(false)
      setEditBody('')
      setMessage('当前版本已保存到本次课次。')
      await reload()
    } catch (saveError) {
      setError(toErrorMessage(saveError, '操作失败，请稍后重试。'))
    } finally {
      setBusyAction('')
    }
  }

  async function regenerate(): Promise<void> {
    if (selectedNote === undefined) return
    if (dirty && !await confirm({
      title: '重新生成修改稿？',
      description: '当前修改尚未保存。重新生成会保留旧草稿，但不会保存这次编辑。',
      confirmLabel: '重新生成',
      destructive: true,
    })) return
    setBusyAction('regenerate')
    const requestId = globalThis.crypto.randomUUID()
    setMessage('正在重新生成，旧结果会继续保留…')
    setError('')
    beginStreaming(requestId)
    try {
      const result = await window.teacherWorkbench.drafts.regenerate({
        requestId,
        noteId: selectedNote.id,
      })
      await reload()
      setSelectedNoteId(result.noteId)
      setEditing(false)
      setEditBody('')
      setMessage('已生成新草稿，旧结果仍然保留。')
    } catch (regenerationError) {
      setMessage('')
      setError(toErrorMessage(regenerationError, '操作失败，请稍后重试。'))
    } finally {
      endStreaming()
      setBusyAction('')
    }
  }

  async function deleteDraft(note: NoteRecord): Promise<void> {
    if (note.draftStatus !== 'draft') return
    if (!await confirm({
      title: '删除未发布修改？',
      description: `这份${kindLabels[note.noteKind as DraftKind]}修改节点尚未发布，删除后无法恢复。`,
      confirmLabel: '删除修改',
      destructive: true,
    })) return
    setBusyAction('delete')
    setError('')
    try {
      await window.teacherWorkbench.drafts.softDelete({ noteId: note.id })
      if (selectedNoteId === note.id) {
        setSelectedNoteId(null)
        setEditing(false)
        setEditBody('')
      }
      setMessage('草稿已删除。')
      await reload()
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, '操作失败，请稍后重试。'))
    } finally {
      setBusyAction('')
    }
  }

  if (context === null) {
    return (
      <DraftInbox
        core={core}
        busy={busyAction !== ''}
        error={error !== '' ? error : coreLoadError}
        message={message}
        onOpenDraft={onOpenDraft}
        onDeleteDraft={(note) => void deleteDraft(note)}
        onBackToCourses={onBackToCourses}
      />
    )
  }

  return (
    <section className="lesson-prep-workspace" aria-live="polite">
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
      {message !== '' && <div className="inline-notice" role="status">{message}</div>}
      <header className="prep-workspace-head">
        <div>
          <p className="section-kicker">AI 修改</p>
          <h2>{context.periodTitle === undefined ? '' : `${context.periodTitle} · `}{context.lessonTitle}</h2>
        </div>
        <div className="prep-workspace-head-actions">
          <button className="secondary-button" type="button" onClick={() => setHistoryOpen(true)}>🕘 修改记录 {lessonResults.length}</button>
          {onOpenCourseware !== undefined && <button className="link-button" type="button" onClick={onOpenCourseware}>退出修改，回到课件</button>}
        </div>
      </header>
      <div className="lesson-prep-workspace-grid">
        <section className="prep-main">
          {/* V19-A（D55）：主舞台——固定位置、同卡替换（方案 → 流式 → 成果 → 对比），不编号不步骤链 */}
          {improvePhase === 'review' ? (
            <section className="workspace-card prep-stage" aria-label="修改方案">
              <div className="prep-stage-head">
                <div><p className="section-kicker">等待确认</p><h3>修改方案（确认后生成）</h3></div>
              </div>
              <div className="improve-plan-body"><MarkdownDocument body={improvePlan} files={[]} /></div>
              {bankEnabled && (
                <div className="prep-stage-bank" aria-label="题库候选题过目">
                  <div className="prep-stage-bank-head">
                    <b>题库候选（可剔除或调整后重选）</b>
                    {bankPlanBusy && <span className="count-label">正在选题…</span>}
                  </div>
                  {bankPlan === null ? (
                    <p className="prep-stage-bank-note" role="status">
                      {bankNotice !== '' ? bankNotice : '尚未完成题库选题；确认生成将不使用题库候选。'}
                    </p>
                  ) : (
                    <>
                      <p className="improve-bank-plan">
                        AI 检索计划：{bankPlan.tags !== undefined && bankPlan.tags.length > 0 ? `tag「${bankPlan.tags.join('、')}」` : '全部 tag'}
                        {' · '}{bankPlan.grade !== undefined ? `年级「${bankPlan.grade}」` : '年级不限'}
                        {' · '}难度 {bankPlan.difficultyMin ?? 0}–{bankPlan.difficultyMax ?? 100}
                        {' · '}目标 {bankPlan.targetCount} 题
                        {bankPlan.text !== undefined ? ` · 关键词「${bankPlan.text}」` : ''}
                      </p>
                      <ul className="improve-bank-candidates">
                        {bankCandidates.map((item) => (
                          <li key={item.id} className={bankExcludedIds.includes(item.id) ? 'is-excluded' : ''}>
                            <label>
                              <input
                                type="checkbox"
                                checked={!bankExcludedIds.includes(item.id)}
                                disabled={bankPlanBusy}
                                onChange={() => toggleBankCandidate(item.id)}
                              />
                              <span>{item.questionNo === null ? '' : `第 ${item.questionNo} 题 `}{item.contentPreview}</span>
                              <small>
                                难度 {item.difficulty === null ? '未标注' : item.difficulty}
                                {item.hasAssets ? ' · 含图' : ''}
                                {item.tags.length > 0 ? ` · ${item.tags.join('、')}` : ''}
                              </small>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <div className="improve-bank-actions">
                        <input
                          value={bankAdjustment}
                          onChange={(event) => setBankAdjustment(event.target.value)}
                          maxLength={DRAFT_REQUIREMENT_MAX_CHARS}
                          placeholder="例如：再难一点；去掉尺规作图题"
                          disabled={bankPlanBusy}
                        />
                        <button className="secondary-button" type="button" disabled={bankPlanBusy} onClick={() => { void reselectBank() }}>调整后重新选题</button>
                      </div>
                      <p className="improve-bank-budget" role="status">
                        已保留 {keptBankCandidates.length} / {bankCandidates.length} 道候选 · {bankCandidateChars.toLocaleString('zh-CN')} 字
                        {bankNotice !== '' ? ` · ${bankNotice}` : ''}
                        {keptBankCandidates.length === 0 ? ' · 候选已全部剔除，请保留至少一道或关闭参考题库' : ''}
                      </p>
                    </>
                  )}
                </div>
              )}
              <div className="prep-stage-actions">
                <button className="primary-button" type="button" onClick={() => void confirmPlanAndGenerate(plannedDraftKind)} disabled={improveBusy}>{improveBusy ? '生成中…' : '✓ 确认并生成'}</button>
                <button className="secondary-button" type="button" onClick={() => void startImprovePlan()} disabled={improveBusy}>让 AI 调整</button>
                <button className="secondary-button" type="button" onClick={abandonImprove} disabled={improveBusy}>放弃</button>
              </div>
            </section>
          ) : streamState !== null ? (
            <section className="workspace-card prep-stage is-streaming" role="status" aria-label="AI 正在生成">
              <div className="draft-stream-head">
                <strong>{streamState.phase === 'reasoning' ? 'AI 正在思考…' : 'AI 正在生成正文…'}</strong>
                <button className="secondary-button" type="button" onClick={() => { void cancelStreaming() }}>取消生成</button>
              </div>
              <p className="draft-stream-reasoning">AI 思考中…（已思考 {streamState.reasoningChars.toLocaleString('zh-CN')} 字，已耗时 {streamElapsedSeconds} 秒）</p>
              {streamState.textPreview !== '' && (
                <div className="draft-stream-preview">
                  <MarkdownDocument body={streamState.textPreview} files={[]} />
                </div>
              )}
            </section>
          ) : selectedNote !== undefined ? (
            <section className="workspace-card prep-stage is-result" aria-label="AI 修改成果">
              {restoreNoticeVisible && selectedNote.draftStatus === 'draft' && (
                <div className="draft-restore-notice" role="status">
                  <span>已恢复最近的工作副本：修改尚未发布，不会改变正式课件与已确认成果。</span>
                  <button className="secondary-button" type="button" onClick={() => setRestoreNoticeVisible(false)}>知道了</button>
                </div>
              )}
              <div className="prep-stage-head">
                <div>
                  <p className="section-kicker">{selectedNote.draftStatus === 'draft' ? '未发布' : '已确认'}</p>
                  <h3>{modificationNodeLabel(selectedNote)}{selectedVariant === 'teacher' ? '（教师版）' : selectedVariant === 'student' ? '（学生版）' : ''}</h3>
                </div>
                <div className="prep-stage-actions">
                  {editing ? (
                    <>
                      <span className="prep-stage-hint">编辑中 · 保存直接更新这份修改节点</span>
                      <button className="link-button" type="button" onClick={() => { void saveModification() }} disabled={busyAction !== ''}>保存修改</button>
                    </>
                  ) : compareOpen ? (
                    <>
                      <span className="prep-stage-hint">新旧对比</span>
                      <button className="secondary-button" type="button" onClick={() => setCompareOpen(false)} disabled={busyAction !== ''}>退出对比</button>
                    </>
                  ) : (
                    <>
                      <button className="secondary-button" type="button" onClick={startEditing} disabled={busyAction !== ''}>✎ 编辑</button>
                      {improveBase !== null && <button className="secondary-button" type="button" onClick={() => setCompareOpen(true)} disabled={busyAction !== ''}>⇄ 新旧对比</button>}
                      {selectedNote.draftStatus === 'draft' && <button className="primary-button" type="button" onClick={() => void publishVersion()} disabled={busyAction !== ''}>⬆ 保存为新版本</button>}
                      {selectedNote.draftStatus !== 'draft' && <button className="secondary-button" type="button" onClick={() => void saveToLesson()} disabled={busyAction !== ''}>保存到本次课次</button>}
                      <div className="prep-result-menu">
                        <button className="secondary-button prep-result-menu-btn" type="button" onClick={() => setResultMenuOpen((open) => !open)} disabled={busyAction !== ''} aria-expanded={resultMenuOpen} aria-haspopup="menu">⋯</button>
                        {resultMenuOpen && (
                          <div className="prep-result-menu-list" role="menu">
                            <button type="button" role="menuitem" onClick={() => { void regenerate() }} disabled={busyAction !== ''}>重新生成</button>
                            {selectedNote.draftStatus === 'draft' && <button type="button" role="menuitem" onClick={() => { void saveToLesson() }} disabled={busyAction !== ''}>保存到本次课次</button>}
                            {onOpenCourseware !== undefined && <button type="button" role="menuitem" onClick={onOpenCourseware} disabled={busyAction !== ''}>查看课件</button>}
                            {selectedNote.draftStatus === 'draft' && (
                              <button type="button" role="menuitem" className="is-danger" onClick={() => { void deleteDraft(selectedNote) }} disabled={busyAction !== ''}>删除草稿</button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {compareOpen && improveBase !== null ? (
                <div className="draft-compare-grid">
                  <div className="draft-compare-pane"><p className="section-kicker">参考课件：{improveBase.title}</p><MarkdownDocument body={improveBase.body} files={[]} /></div>
                  <div className="draft-compare-pane"><p className="section-kicker">新工作副本（未发布）</p><MarkdownDocument body={selectedNote.bodyMd} files={[]} /></div>
                </div>
              ) : editing ? (
                <div className="prep-stage-editor">
                  <MdEditor
                    key={selectedNote.id}
                    files={lessonFiles}
                    initialBody={selectedNote.bodyMd}
                    storageKey={`md-editor-draft:note:${selectedNote.id}`}
                    onBodyChange={setEditBody}
                    onSaveBody={async (bodyMd) => {
                      await window.teacherWorkbench.core.updateNote({ noteId: selectedNote.id, bodyMd })
                      setEditing(false)
                      setEditBody('')
                      setMessage('修改已保存。')
                      await reload()
                    }}
                    onCancel={cancelEditing}
                  />
                </div>
              ) : (
                <div className="draft-content-body is-preview">
                  <MarkdownDocument body={selectedNote.bodyMd} files={[]} />
                </div>
              )}
            </section>
          ) : (
            <div className="workspace-card draft-content-empty" role="status">
              {prepMode === 'new'
                ? <p>还没有生成内容。右侧添加依据或直接写要求，点「✦ 发送」开始从零生成；生成后节点会出现在「修改记录」里。</p>
                : <p>还没有修改方案。右侧说清这次要改什么，点「✦ 发送」先出方案，确认后才会生成新副本。</p>}
            </div>
          )}
        </section>
        {/* V19-A（D55）：对话栏——与 AI 对话（依据区 + 对 AI 说 + 发送），窄窗折叠为摘要条 */}
        <aside className="workspace-card prep-chat" aria-label="与 AI 对话">
          {chatCollapsed ? (
            <button className="prep-chat-collapsed" type="button" onClick={() => setChatCollapsed(false)}>
              <b>✦ 对话栏已折叠</b>
              <span>
                {prepMode === 'new'
                  ? `从零生成 · 已选 ${selectedReferenceFiles.length} 份依据`
                  : prepMode === 'single'
                    ? `改《${targetFile?.originalName ?? '尚未选择'}》`
                    : `整个课件包（${lessonBaselineFiles.length} 份）`}
                {requirement.trim() === '' ? ' · 要求未填写' : ` · 要求「${requirement.trim().slice(0, 12)}…」`}
              </span>
              <small>展开对话栏</small>
            </button>
          ) : (
            <>
              <div className="prep-chat-head">
                <b>✦ 与 AI 对话</b>
                <button className="prep-mini-btn" type="button" onClick={() => setChatCollapsed(true)}>折叠</button>
              </div>
              {prepMode === 'new' ? (
                <div className="prep-chat-basis prep-chat-new" aria-label="生成依据">
                  {files === null ? <div className="material-reader-state">正在读取本次资料…</div> : selectedReferenceFileIds.length > 0 ? (
                    <>
                      {selectedReferenceFiles.map((file) => (
                        <span key={file.id} className="prep-chip">
                          <span>{file.originalName}</span>
                          <button className="prep-chip-remove" type="button" aria-label={`移除依据 ${file.originalName}`} disabled={busyAction !== ''} onClick={() => toggleReferenceFile(file.id)}>✕</button>
                        </span>
                      ))}
                      <button className="prep-add-mini" type="button" disabled={busyAction !== ''} onClick={() => setRefPickerOpen((current) => !current)}>＋ 本课资料</button>
                      {refPickerOpen && (
                        <ScopeFileList files={referenceCandidates} selection="checkbox" selectedIds={selectedReferenceFileIds} onSelect={toggleReferenceFile} currentVersionId={classifiedFiles.currentVersion?.id} charCounts={referenceCharCounts} emptyText="本课没有可作生成依据的课内资料。" />
                      )}
                      <button className="prep-add-mini" type="button" disabled={busyAction !== ''} onClick={onBrowseExternal}>＋ 外部资料</button>
                      <button className="prep-add-mini" type="button" disabled={busyAction !== ''} onClick={onBrowseMaterials}>＋ 素材库</button>
                    </>
                  ) : (
                    <div className="prep-add-cards">
                      <button className="prep-add-card" type="button" disabled={busyAction !== ''} onClick={onBrowseExternal}>
                        <span className="prep-add-card-plus" aria-hidden="true">＋</span>
                        <b>从外部资料添加</b>
                        <small>从已登记的外部资料根目录中选择文件作为生成依据</small>
                      </button>
                      <button className="prep-add-card" type="button" disabled={busyAction !== ''} onClick={onBrowseMaterials}>
                        <span className="prep-add-card-plus" aria-hidden="true">＋</span>
                        <b>从素材库添加</b>
                        <small>从素材库挑取素材插入本课资料</small>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="prep-chat-basis" aria-label="这次改什么">
                  <p className="prep-chat-basis-label">这次改什么</p>
                  <label className={`prep-scope-option${prepMode === 'single' ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="prep-chat-scope"
                      checked={prepMode === 'single'}
                      disabled={busyAction !== '' || improveBusy || aiEditableCurrentFiles.length === 0}
                      onChange={() => selectChatScope('single')}
                    />
                    <span className="prep-scope-option-main">
                      <b>这份讲义</b>
                      <small>自动挂当前讲义，AI 只改这份，未提及部分保持不变</small>
                    </span>
                    <span className="prep-auto-badge" aria-label="自动选择当前讲义">自动</span>
                  </label>
                  <label className={`prep-scope-option${prepMode === 'lesson' ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="prep-chat-scope"
                      checked={prepMode === 'lesson'}
                      disabled={busyAction !== '' || improveBusy || appGeneratedCurrentFiles.length === 0}
                      onChange={() => selectChatScope('lesson')}
                    />
                    <span className="prep-scope-option-main">
                      <b>整个课件包</b>
                      <small>{appGeneratedCurrentFiles.length} 份当前版课件全部重做（讲义 + 例题 + 练习 + 作业）</small>
                    </span>
                  </label>
                  {prepMode === 'single' && (
                    scopePickerOpen ? (
                      <>
                        <ScopeFileList files={modifiableCurrentFiles} selection="radio" selectedIds={targetFile === null ? [] : [targetFile.id]} onSelect={selectTargetFile} currentVersionId={classifiedFiles.currentVersion?.id} charCounts={referenceCharCounts} emptyText="本课还没有 Markdown 课件，可先导入 md 讲义或用 AI 生成第一版课件。" />
                        <button className="prep-mini-btn" type="button" onClick={() => setScopePickerOpen(false)}>收起</button>
                      </>
                    ) : (
                      <div className="prep-target-card">
                        <span className="prep-file-glyph" aria-hidden="true">MD</span>
                        <span className="prep-target-meta">
                          <b>{targetFile?.originalName ?? '尚未选择'}</b>
                          <small>
                            {targetFile === null ? '—' : `${(referenceCharCounts.get(targetFile.id) ?? 0).toLocaleString('zh-CN')} 字`}
                            {targetFile !== null && targetFile.id === classifiedFiles.currentVersion?.id ? ' · 当前版' : ''} · {kindLabels[plannedDraftKind]}
                          </small>
                        </span>
                        {modifiableCurrentFiles.length > 1 && (
                          <button className="prep-mini-btn" type="button" disabled={busyAction !== '' || improveBusy} onClick={() => setScopePickerOpen(true)}>更换</button>
                        )}
                      </div>
                    )
                  )}
                  <p className="prep-chat-ref-label">补充参考（AI 只用来理解要求）</p>
                  {selectedReferenceFiles.map((file) => (
                    <span key={file.id} className="prep-chip">
                      <span>{file.originalName}</span>
                      <button className="prep-chip-remove" type="button" aria-label={`移除参考 ${file.originalName}`} disabled={busyAction !== ''} onClick={() => toggleReferenceFile(file.id)}>✕</button>
                    </span>
                  ))}
                  <button className="prep-add-mini" type="button" disabled={busyAction !== ''} onClick={() => setRefPickerOpen((current) => !current)}>＋ 本课资料</button>
                  {refPickerOpen && (
                    <ScopeFileList files={referenceCandidates} selection="checkbox" selectedIds={selectedReferenceFileIds} onSelect={toggleReferenceFile} currentVersionId={classifiedFiles.currentVersion?.id} charCounts={referenceCharCounts} emptyText="本课没有可作参考的额外资料。" />
                  )}
                  <button className="prep-add-mini" type="button" disabled={busyAction !== ''} onClick={onBrowseExternal}>＋ 外部资料</button>
                  <button className="prep-add-mini" type="button" disabled={busyAction !== ''} onClick={onBrowseMaterials}>＋ 素材库</button>
                </div>
              )}
              <div className="prep-chat-basis">
                <label className={`prep-switch-row${(bankSummary?.installed ?? false) ? '' : ' is-disabled'}`} title={(bankSummary?.installed ?? false) ? undefined : '先在题库页导入 .tqbank'}>
                  参考题库
                  <input
                    className="prep-switch-input"
                    type="checkbox"
                    checked={bankEnabled}
                    disabled={!(bankSummary?.installed ?? false) || busyAction !== '' || improveBusy}
                    onChange={toggleBankEnabled}
                  />
                  <span className="prep-switch" aria-hidden="true" />
                </label>
                {bankEnabled && (
                  <div className="prep-bank-controls">
                    <PrepBankOptions
                      bankTargetCount={bankTargetCount}
                      onTargetCountChange={(count) => {
                        setBankTargetCount(count)
                        clearBankSelection()
                      }}
                      dualVersionEnabled={dualVersionEnabled}
                      onDualVersionChange={setDualVersionEnabled}
                      disabled={bankPlanBusy || busyAction !== '' || improveBusy}
                    />
                  </div>
                )}
                <p className={`prep-chat-budget${referenceBudgetExceeded ? ' is-over' : ''}`} role="status">
                  {referenceNotice !== '' ? `${referenceNotice} · ` : ''}
                  依据与参考已用 {scopedCharTotal.toLocaleString('zh-CN')} / {DRAFT_DEFAULT_MAX_CHARS.toLocaleString('zh-CN')} 字 · 参考 {selectedReferenceFiles.length} / {DRAFT_MAX_REFERENCE_FILES} 份
                  {bankEnabled && keptBankCandidates.length > 0 ? ` · 题库候选 ${keptBankCandidates.length} 题` : ''}
                  {referenceFilesFull ? ` · 已选满 ${DRAFT_MAX_REFERENCE_FILES} 份` : ''}
                  {referenceBudgetExceeded ? ' · 已超预算，生成时按预算截减并需确认' : ''}
                </p>
              </div>
              <div className="prep-chat-say">
                <p className="prep-chat-basis-label">对 AI 说</p>
                <textarea value={requirement} onChange={(event) => setRequirement(event.target.value)} maxLength={DRAFT_REQUIREMENT_MAX_CHARS} rows={5} placeholder="例如：每个概念后配一道即时练习；平方根易错点整理成辨析表；这次完全不行，整个重做。" disabled={busyAction !== '' || improveBusy} />
                <div className="prep-chat-send">
                  <label className="improve-kind-label">Skill：
                    <select value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)} disabled={busyAction !== '' || improveBusy}>
                      <option value="">不使用 Skill</option>
                      {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                    </select>
                  </label>
                  {prepMode === 'new' && (
                    <label className="improve-kind-label">生成类型：
                      <select value={improveKind} onChange={(event) => setImproveKind(event.target.value as DraftKind)} disabled={busyAction !== '' || improveBusy}>
                        <option value="lecture">讲义</option>
                        <option value="example">例题</option>
                        <option value="homework">作业</option>
                      </select>
                    </label>
                  )}
                  <button className="primary-button" type="button" onClick={() => { void (prepMode === 'new' ? generate(plannedDraftKind) : startImprovePlan()) }} disabled={busyAction !== '' || improveBusy || (prepMode !== 'new' && selectedFiles.length === 0)}>
                    {busyAction !== '' || improveBusy ? '生成中…' : '✦ 发送'}
                  </button>
                </div>
                {improveError !== '' && <p className="inline-error" role="alert">{improveError}</p>}
                {prepMode === 'single' && aiEditableCurrentFiles.length === 0 && (
                  <div className="inline-notice" role="status">
                    本课还没有 Markdown 课件，可先导入 md 讲义或用 AI 生成第一版课件。
                  </div>
                )}
                {prepMode === 'lesson' && appGeneratedCurrentFiles.length === 0 && (
                  <div className="inline-notice" role="status">
                    本课还没有应用内生成的课件版本，整个课件包重做需要先用 AI 生成第一版课件；单文件修改已支持外部导入的 md。
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
      {historyOpen && (
        <div className="teaching-content-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false) }}>
          <aside className="teaching-content-drawer prep-history-drawer" aria-label="修改记录">
            <header>
              <div><span className="section-kicker">本课节点</span><h2>修改记录 {lessonResults.length} 份</h2></div>
              <button className="modal-close" type="button" aria-label="关闭修改记录" onClick={() => setHistoryOpen(false)}>×</button>
            </header>
            <ul className="draft-result-list prep-history-list">
              {lessonResults.map((note) => {
                const kind = note.noteKind as DraftKind
                const variant = draftNoteMetadata(note)?.variant
                return (
                  <li key={note.id} className={selectedNote?.id === note.id ? 'is-selected' : ''}>
                    <button type="button" className="draft-result-select" onClick={() => { void selectResult(note); setHistoryOpen(false) }} disabled={busyAction !== ''}>
                      <span className="draft-kind-icon" aria-hidden="true">{kindIcon(kind)}</span>
                      <span><strong>{modificationNodeLabel(note)}</strong><small>{formatDateTime(note.updatedAt)}</small></span>
                      <span className="draft-row-badges">
                        {variant === 'teacher' && <span className="draft-variant-badge is-teacher">教师版</span>}
                        {variant === 'student' && <span className="draft-variant-badge is-student">学生版</span>}
                        <span className={`draft-status draft-status-${note.draftStatus}`}>{note.draftStatus === 'draft' ? '修改中' : '已确认'}</span>
                      </span>
                    </button>
                    {note.draftStatus === 'draft' && <button className="danger-button" type="button" onClick={() => void deleteDraft(note)} disabled={busyAction !== ''}>删除</button>}
                  </li>
                )
              })}
              {lessonResults.length === 0 && <li className="empty-state">还没有修改节点。生成后每个节点都会出现在这里，AI 结果永不覆盖原件。</li>}
            </ul>
          </aside>
        </div>
      )}
    </section>
  )
}

/**
 * D35（V1.7.2）：目标题数可选可填写（datalist 快捷 + 自由输入），
 * 边界与合同一致 1..80——输入实时镜像 DOM，失焦统一收口：超限钳到 80、清空/非法回退已提交值。
 */
const BANK_TARGET_COUNT_PRESETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 30, 40, 50, 80]

function PrepBankOptions({ bankTargetCount, onTargetCountChange, dualVersionEnabled, onDualVersionChange, disabled }: {
  readonly bankTargetCount: number
  readonly onTargetCountChange: (count: number) => void
  readonly dualVersionEnabled: boolean
  readonly onDualVersionChange: (enabled: boolean) => void
  readonly disabled: boolean
}): React.JSX.Element {
  const [rawCount, setRawCount] = useState(String(bankTargetCount))
  useEffect(() => { setRawCount(String(bankTargetCount)) }, [bankTargetCount])

  function commitFromRaw(raw: string): void {
    const parsed = Number(raw)
    const valid = raw !== '' && Number.isInteger(parsed) && parsed >= DRAFT_BANK_PLAN_MIN_TARGET_COUNT
    const final = valid ? Math.min(parsed, DRAFT_BANK_PLAN_MAX_TARGET_COUNT) : bankTargetCount
    if (final !== bankTargetCount) onTargetCountChange(final)
    if (String(final) !== raw) setRawCount(String(final))
  }

  return (
    <span className="prep-bank-controls-inner">
      <label>目标题数：
        <input
          className="prep-bank-count-input"
          type="number"
          list="prep-bank-count-presets"
          min={DRAFT_BANK_PLAN_MIN_TARGET_COUNT}
          max={DRAFT_BANK_PLAN_MAX_TARGET_COUNT}
          step={1}
          value={rawCount}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.currentTarget.value
            setRawCount(raw)
            const parsed = Number(raw)
            if (raw !== '' && Number.isInteger(parsed) && parsed >= DRAFT_BANK_PLAN_MIN_TARGET_COUNT) {
              const clamped = Math.min(parsed, DRAFT_BANK_PLAN_MAX_TARGET_COUNT)
              if (clamped !== bankTargetCount) onTargetCountChange(clamped)
            }
          }}
          onBlur={(event) => commitFromRaw(event.currentTarget.value)}
        />
        <datalist id="prep-bank-count-presets">
          {BANK_TARGET_COUNT_PRESETS.map((count) => (
            <option key={count} value={count} />
          ))}
        </datalist>
      </label>
      <label>
        <input
          type="checkbox"
          checked={dualVersionEnabled}
          disabled={disabled}
          onChange={(event) => onDualVersionChange(event.currentTarget.checked)}
        />
        同时生成学生版
      </label>
    </span>
  )
}

function ScopeFileList({ files, selection, selectedIds, onSelect, currentVersionId, charCounts, emptyText }: {
  readonly files: readonly ManagedFileRecord[]
  readonly selection: 'checkbox' | 'radio' | 'summary'
  readonly selectedIds: readonly string[]
  readonly onSelect: (fileId: string) => void
  readonly currentVersionId?: string
  readonly charCounts?: ReadonlyMap<string, number>
  readonly emptyText: string
}): React.JSX.Element {
  if (files.length === 0) return <p className="empty-state prep-scope-empty">{emptyText}</p>
  return (
    <ul className="prep-scope-file-list">
      {files.map((file) => {
        const chars = charCounts?.get(file.id)
        return (
          <li key={file.id}>
            <label className={selectedIds.includes(file.id) ? 'is-selected' : ''}>
              {selection !== 'summary' && (
                <input
                  type={selection}
                  name={selection === 'radio' ? 'prep-target-file' : undefined}
                  checked={selectedIds.includes(file.id)}
                  onChange={() => onSelect(file.id)}
                />
              )}
              <span className="prep-scope-file-name">{file.originalName}</span>
              {chars !== undefined && <span className="prep-scope-file-chars">{chars.toLocaleString('zh-CN')} 字</span>}
              {file.id === currentVersionId && <span className="prep-current-badge">当前</span>}
              {lessonFileSourceLabel(file) !== null && (
                <span className="prep-source-badge">{lessonFileSourceLabel(file)}</span>
              )}
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function DraftInbox({ core, busy, error, message, onOpenDraft, onDeleteDraft, onBackToCourses }: {
  readonly core: CoreOverview | null
  readonly busy: boolean
  readonly error: string
  readonly message: string
  readonly onOpenDraft: (context: LessonPrepContext, noteId: string) => void
  readonly onDeleteDraft: (note: NoteRecord) => void
  readonly onBackToCourses: () => void
}): React.JSX.Element {
  const entries = listDraftInbox(core)
  return (
    <section className="draft-inbox-panel" aria-label="修改记录">
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
      {message !== '' && <div className="inline-notice" role="status">{message}</div>}
      <div className="workspace-card">
        <div className="card-heading">
          <div><p className="section-kicker">AI 协作</p><h2>修改记录</h2><p>这里列出各课次尚未发布（修改中）的 AI 修改节点，点击进入对应课次的 AI 备课。</p></div>
          <span className="count-label">{entries.length} 份</span>
        </div>
        <ul className="draft-inbox-list">
          {entries.map((entry) => (
            <DraftInboxRow key={entry.note.id} entry={entry} busy={busy} onOpenDraft={onOpenDraft} onDeleteDraft={onDeleteDraft} />
          ))}
          {core === null && <li className="empty-state">正在读取草稿…</li>}
          {core !== null && entries.length === 0 && <li className="empty-state">暂无修改节点。生成内容后会自动出现在这里。</li>}
        </ul>
        <button className="secondary-button" type="button" onClick={onBackToCourses}>前往我的课程开始备课</button>
      </div>
    </section>
  )
}

function DraftInboxRow({ entry, busy, onOpenDraft, onDeleteDraft }: {
  readonly entry: DraftInboxEntry
  readonly busy: boolean
  readonly onOpenDraft: (context: LessonPrepContext, noteId: string) => void
  readonly onDeleteDraft: (note: NoteRecord) => void
}): React.JSX.Element {
  const kind = entry.note.noteKind as DraftKind
  const variant = draftNoteMetadata(entry.note)?.variant
  return (
    <li>
      <button className="draft-inbox-open" type="button" disabled={busy || entry.context === null} onClick={() => entry.context !== null && onOpenDraft(entry.context, entry.note.id)}>
        <span className="draft-kind-icon" aria-hidden="true">{kindIcon(kind)}</span>
        <span><strong>{modificationNodeLabel(entry.note)}</strong><small>{entry.courseTitle} / {entry.lessonTitle}</small></span>
        {variant !== undefined && (
          <span className={`draft-variant-badge is-${variant}`}>{variant === 'teacher' ? '教师版' : '学生版'}</span>
        )}
        <time dateTime={entry.note.updatedAt}>{formatDateTime(entry.note.updatedAt)}</time>
      </button>
      <button className="danger-button" type="button" disabled={busy} onClick={() => onDeleteDraft(entry.note)}>删除</button>
    </li>
  )
}

async function readScopedTextParts(
  baselineFiles: readonly ManagedFileRecord[],
  referenceFiles: readonly ManagedFileRecord[],
  maxChars: number,
): Promise<ScopedTextResult> {
  let remaining = maxChars
  let truncated = false

  async function readGroup(group: readonly ManagedFileRecord[]): Promise<ScopedTextPart[]> {
    const parts: ScopedTextPart[] = []
    for (const file of group) {
      if (remaining <= 0) {
        truncated = true
        break
      }
      const content = await window.teacherWorkbench.files.readContent({ fileId: file.id })
      if (content.kind !== 'text' || content.content.trim() === '') continue
      const body = content.content.slice(0, remaining)
      if (body.length < content.content.length) truncated = true
      if (body.trim() === '') continue
      parts.push({ fileId: file.id, title: file.originalName, body })
      remaining -= body.length
    }
    return parts
  }

  const baselineParts = await readGroup(baselineFiles)
  const referenceParts = await readGroup(referenceFiles)
  return { baselineParts, referenceParts, truncated }
}

function buildPlanPrompt(
  mode: ModificationMode,
  teacherRequirement: string,
  scopedText: ScopedTextResult,
): string {
  const baselineHeading = mode === 'single' ? '唯一修改对象' : '自动整课基线'
  const roleInstruction = mode === 'single'
    ? '老师要修改一份指定课件。只能把「唯一修改对象」视为待修改文件；补充参考只用于理解要求，不能变成额外修改对象。'
    : '老师要按新要求重做整节课。请把「自动整课基线」视为原课完整范围；补充参考只用于辅助，不得替代基线。'
  const planInstruction = mode === 'single'
    ? '分条说明对目标文件每处「改什么、为什么、怎么改」；未被要求修改的内容应保持；不要输出修改后的全文。'
    : '先概括整课结构与难度调整，再分条说明讲义、典型例题、课堂互动练习、课后作业及其衔接各自「改什么、为什么、怎么改」；不要输出重做后的全文。'
  return [
    '你是一位备课助理。请基于老师的明确要求，输出一份可审阅的修改方案。',
    roleInstruction,
    `${planInstruction} 全文控制在 500 字以内，使用中文。`,
    `老师修改要求：${teacherRequirement}`,
    `${baselineHeading}：`,
    ...scopedText.baselineParts.map(formatScopedTextPart),
    ...(scopedText.referenceParts.length === 0
      ? ['补充参考：无']
      : ['补充参考（只辅助理解）：', ...scopedText.referenceParts.map(formatScopedTextPart)]),
  ].join(String.fromCharCode(10, 10))
}

function buildComparisonBase(
  mode: ModificationMode,
  baselineParts: readonly ScopedTextPart[],
): { title: string; body: string } | null {
  if (baselineParts.length === 0) return null
  if (mode === 'single') {
    return { title: baselineParts[0].title, body: baselineParts[0].body }
  }
  return {
    title: `整课原始基线（${baselineParts.length} 份）`,
    body: baselineParts.map((part) => `## ${part.title}${String.fromCharCode(10, 10)}${part.body}`).join(String.fromCharCode(10, 10)),
  }
}

function formatScopedTextPart(part: ScopedTextPart): string {
  return `【${part.title}】${String.fromCharCode(10)}${part.body}`
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)]
}


function kindIcon(kind: DraftKind): string { return kind === 'lecture' ? '讲' : kind === 'example' ? '例' : '作' }

function inferDraftKind(file: ManagedFileRecord | null): DraftKind {
  if (file === null) return DRAFT_KINDS.lecture
  if (/作业|课后|习题/u.test(file.originalName)) return DRAFT_KINDS.homework
  if (/例题|练习|题目/u.test(file.originalName)) return DRAFT_KINDS.example
  return DRAFT_KINDS.lecture
}

function uniqueFiles(files: readonly ManagedFileRecord[]): ManagedFileRecord[] {
  const seen = new Set<string>()
  return files.filter((file) => {
    if (seen.has(file.id)) return false
    seen.add(file.id)
    return true
  })
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('zh-CN', { hour12: false })
}
