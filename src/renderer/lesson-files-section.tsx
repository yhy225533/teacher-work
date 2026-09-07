import { useEffect, useMemo, useState } from 'react'

import type { NodeRecord, NoteRecord } from '../shared/core-contracts'
import type { ManagedFileOverview } from '../shared/file-contracts'
import { useCoreOverview } from './core-overview-provider'
import {
  classifyLessonCoursewareFiles,
  filterLessonMaterialFiles,
  isAiEditableFile,
  isAppGeneratedCoursewareFile,
  isLessonLectureFile,
  lessonFileSourceLabel,
  listLessonPrepFiles,
  type LessonPrepContext,
} from './lesson-prep-context'
import { isMineruEnhanceableFile } from './managed-files-panel'
import LessonMaterialReader from './lesson-material-reader'
import { AppMenuButton, type AppMenuEntry } from './app-menu'
import { useAppDialog } from './app-confirm-dialog'
import type { PrepLaunchIntent } from './teaching-content-context'
import { formatBytes, toErrorMessage } from './ui-utils'

// Legacy V1.2 boundary retained: 不包含整门课程资料或学生文件。

export default function LessonFilesSection({
  lesson,
  periodTitle,
  prepContext,
  draft,
  readOnly = false,
  immersive = false,
  onToggleImmersive,
  onStartPrep,
  onOpenDraft,
}: {
  readonly lesson: NodeRecord | null
  readonly periodTitle: string
  readonly prepContext: LessonPrepContext | null
  readonly draft: NoteRecord | null
  readonly readOnly?: boolean
  readonly immersive?: boolean
  readonly onToggleImmersive?: () => void
  readonly onStartPrep: (context: LessonPrepContext, intent?: PrepLaunchIntent) => void
  readonly onOpenDraft: (context: LessonPrepContext, noteId: string) => void
}): React.JSX.Element {
  const { confirm } = useAppDialog()
  const { overview: core, reload: reloadCore } = useCoreOverview()
  const [overview, setOverview] = useState<ManagedFileOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedFileId, setSelectedFileId] = useState('')
  const [mineruTokenConfigured, setMineruTokenConfigured] = useState(false)
  const [mineruStatus, setMineruStatus] = useState<{ state: 'queued' | 'running' | 'done' | 'failed'; message?: string } | null>(null)
  const [mineruBusy, setMineruBusy] = useState(false)
  const lessonFiles = useMemo(
    () => overview === null || lesson === null ? [] : filterLessonMaterialFiles(
      listLessonPrepFiles(overview, lesson.id),
      { lessonLabel: lesson.lessonLabel, periodTitle },
    ),
    [lesson, overview, periodTitle],
  )
  const classifiedFiles = useMemo(() => classifyLessonCoursewareFiles(lessonFiles), [lessonFiles])
  const currentVersionFile = classifiedFiles.currentVersion
  const historyFiles = classifiedFiles.history
  const displayFiles = classifiedFiles.currentMaterials
  const selectedFile = displayFiles.find((file) => file.id === selectedFileId) ?? null
  // D27（V17-B）：AI 修改面向本课全部 md（含外部导入 md）；office/pdf/图片保持只读浏览。
  const canModifySelectedFile = selectedFile !== null && isAiEditableFile(selectedFile)
  const hasAnyMarkdown = displayFiles.some(isAiEditableFile)
  const hasAppGeneratedCourseware = displayFiles.some(isAppGeneratedCoursewareFile)

  useEffect(() => {
    if (currentVersionFile !== null && selectedFileId === '') {
      setSelectedFileId(currentVersionFile.id)
    }
  }, [currentVersionFile, selectedFileId])

  useEffect(() => {
    setSelectedFileId(currentVersionFile?.id ?? '')
    void reload()
  }, [lesson?.id])

  useEffect(() => {
    void window.teacherWorkbench.mineru.getSettings()
      .then((settings) => setMineruTokenConfigured(settings.tokenConfigured))
      .catch(() => setMineruTokenConfigured(false))
  }, [])

  useEffect(() => {
    if (selectedFileId === '') { setMineruStatus(null); return }
    let cancelled = false
    void window.teacherWorkbench.mineru.getStatus({ fileId: selectedFileId })
      .then((status) => { if (!cancelled) setMineruStatus(status) })
      .catch(() => { if (!cancelled) setMineruStatus(null) })
    return () => { cancelled = true }
  }, [selectedFileId])

  useEffect(() => window.teacherWorkbench.files.onContentChanged(() => { void reload() }), [])

  async function reload(): Promise<void> {
    try {
      setOverview(await window.teacherWorkbench.files.getOverview())
      setError('')
    } catch (loadError) {
      setError(toErrorMessage(loadError, '课次资料读取失败，请稍后重试。'))
    }
  }

  async function openFile(fileId: string, reveal = false): Promise<void> {
    setBusy(true)
    setError('')
    try {
      if (reveal) await window.teacherWorkbench.files.showFileInFolder({ fileId })
      else await window.teacherWorkbench.files.openFile({ fileId })
    } catch (openError) {
      setError(toErrorMessage(openError, '课次资料读取失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  async function removeFile(fileId: string): Promise<void> {
    if (lesson === null) return
    const file = lessonFiles.find((candidate) => candidate.id === fileId)
    if (file === undefined) return
    const confirmed = await confirm({
      title: '从本课移除资料？',
      description: <>“{file.originalName}”将从“{lesson.title}”移除。<br />只移除本课的独立副本，不会影响素材库原件或外部资料。</>,
      confirmLabel: '从本课移除',
      destructive: true,
    })
    if (!confirmed) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await window.teacherWorkbench.files.softDeleteFile({ fileId })
      setSelectedFileId('')
      await reload()
      setNotice(`已从本课移除“${file.originalName}”。`)
    } catch (removeError) {
      setError(toErrorMessage(removeError, '课次资料读取失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  function openNewPrep(): void {
    if (prepContext === null) return
    if (draft === null) onStartPrep(prepContext, { mode: 'new' })
    else onOpenDraft(prepContext, draft.id)
  }

  function modifySelectedFile(): void {
    if (prepContext === null || selectedFile === null || !isAiEditableFile(selectedFile)) return
    onStartPrep(prepContext, { mode: 'single', targetFileId: selectedFile.id })
  }

  async function enhanceWithMineru(fileId: string): Promise<void> {
    setMineruBusy(true)
    setError('')
    setNotice('')
    try {
      await window.teacherWorkbench.mineru.enhanceFile({ fileId })
      const status = await window.teacherWorkbench.mineru.getStatus({ fileId })
      setMineruStatus(status)
      setNotice('已提交增强解析，云端进行中，完成后此文件在 AI 备课与搜索中自动使用增强文本。')
    } catch (enhanceError) {
      setError(toErrorMessage(enhanceError, '增强解析提交失败，请稍后重试。'))
    } finally {
      setMineruBusy(false)
    }
  }

  function rebuildLesson(): void {
    if (prepContext === null) return
    onStartPrep(prepContext, { mode: 'lesson' })
  }

  /** V1.8.1/D46：设为讲义底稿——新讲义副本入版本链并选中，原件保留在材料区。 */
  async function promoteToLecture(fileId: string): Promise<void> {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const promoted = await window.teacherWorkbench.files.setLessonFileRole({ fileId })
      await reload()
      setSelectedFileId(promoted.file.id)
      setNotice(`已设为讲义底稿《${promoted.file.originalName}》（第 ${promoted.version} 版），原件保留在材料区。`)
    } catch (promoteError) {
      setError(toErrorMessage(promoteError, '设为讲义底稿失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  /** V17-C/D28：本课“人工编辑”来源标注（note_kind='manual_edit'，最多显示最近 5 条）。 */
  const lessonId = lesson?.id ?? null
  const manualEditNotes = useMemo(() => {
    if (lessonId === null || core === null) return []
    return core.notes
      .filter((note) =>
        note.deletedAt === null &&
        note.lessonId === lessonId &&
        note.noteKind === 'manual_edit',
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5)
  }, [core, lessonId])

  // V19-B（D57）：编辑态提升到工具行（✎ 编辑主键），阅读器只消费受控态
  const [editing, setEditing] = useState(false)
  useEffect(() => { setEditing(false) }, [selectedFileId])
  const canEditSelectedFile = !readOnly && selectedFile !== null && selectedFile.mimeType === 'text/markdown'
  const canPromoteSelectedFile = !readOnly && selectedFile !== null
    && selectedFile.mimeType === 'text/markdown'
    && !isLessonLectureFile(selectedFile)
  const mineruEnhanceable = selectedFile !== null && isMineruEnhanceableFile(selectedFile) && mineruStatus?.state !== 'done'
  const mineruRunning = mineruBusy || mineruStatus?.state === 'running' || mineruStatus?.state === 'queued'

  /** V19-B（D57）：⋯ 收纳菜单——分组"本课/本文件"，危险项在底部红区（从本课移除）。 */
  const menuEntries = useMemo<AppMenuEntry[]>(() => {
    const entries: AppMenuEntry[] = [
      { kind: 'group', key: 'lesson-group', label: '本课' },
      { kind: 'item', key: 'refresh', label: '刷新', onSelect: () => { void reload() }, disabled: busy },
    ]
    if (!readOnly) {
      if (draft !== null) {
        entries.push({ kind: 'item', key: 'continue', label: '继续上次修改', onSelect: () => { if (prepContext !== null) onOpenDraft(prepContext, draft.id) }, disabled: busy })
      }
      if (hasAppGeneratedCourseware) {
        entries.push({ kind: 'item', key: 'rebuild', label: '整个课件包重做', onSelect: rebuildLesson, disabled: busy })
      }
    }
    entries.push({ kind: 'group', key: 'file-group', label: '本文件' })
    if (selectedFile !== null) {
      if (canPromoteSelectedFile) {
        entries.push({ kind: 'item', key: 'promote', label: '设为讲义底稿', title: '复制为“基名 · 第 N 版.md”进入本课讲义版本链，原件保留在材料区', onSelect: () => { void promoteToLecture(selectedFile.id) }, disabled: busy })
      }
      entries.push({ kind: 'item', key: 'open', label: '系统打开', onSelect: () => { void openFile(selectedFile.id) }, disabled: busy })
      entries.push({ kind: 'item', key: 'folder', label: '所在文件夹', onSelect: () => { void openFile(selectedFile.id, true) }, disabled: busy })
      if (!readOnly && mineruEnhanceable) {
        entries.push({
          kind: 'item',
          key: 'mineru',
          label: !mineruTokenConfigured
            ? '增强解析（需配置 token）'
            : mineruRunning
              ? '增强解析中…'
              : '增强解析',
          title: !mineruTokenConfigured
            ? '扫描件增强解析需先在设置中配置 MinerU token（会配置后此处即可点击）'
            : '上传到 MinerU 云端解析，公式转 LaTeX、扫描件识别',
          onSelect: () => { void enhanceWithMineru(selectedFile.id) },
          disabled: !mineruTokenConfigured || mineruRunning || busy,
        })
      }
      if (!readOnly) {
        entries.push({ kind: 'separator', key: 'danger-sep' })
        entries.push({ kind: 'item', key: 'remove', label: '从本课移除', onSelect: () => { void removeFile(selectedFile.id) }, disabled: busy, danger: true })
      }
    }
    return entries
  }, [busy, canPromoteSelectedFile, draft, hasAppGeneratedCourseware, mineruEnhanceable, mineruRunning, mineruTokenConfigured, readOnly, selectedFile])

  /** V17-C：人工编辑保存新版本后刷新课件清单与共享 overview（manual_edit 标注由 overview 数据驱动）。 */
  async function handleManualEditSaved(fileId: string): Promise<void> {
    setNotice('已保存为新版本，旧版保留在历史版本。')
    await reload()
    await reloadCore()
    setSelectedFileId(fileId)
  }

  if (lesson === null) {
    return (
      <div className="lesson-files-section lesson-files-empty">
        <h3>课次资料</h3>
        <p>请先选择一个课次查看资料。</p>
      </div>
    )
  }

  return (
    <div className={`lesson-files-section${immersive ? ' is-immersive' : ''}`} aria-live="polite">
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
      {notice !== '' && <div className="inline-notice" role="status">{notice}</div>}
      {/* V19-B（D57）：三层头部并为单条工具行——课次标题 + 当前文件信息胶囊 ｜ 三主键 + 沉浸阅读 + ⋯ */}
      <header className="lesson-files-toolbar">
        <div className="lesson-files-toolbar-main">
          <h3>{periodTitle === '' ? lesson.title : `${periodTitle} · ${lesson.title}`}</h3>
          {selectedFile !== null ? (
            <span className="lesson-file-capsule">
              <b>{selectedFile.originalName}</b>
              {selectedFile.id === currentVersionFile?.id && <small className="is-current">当前</small>}
              <small>{formatBytes(selectedFile.sizeBytes)}</small>
              {lessonFileSourceLabel(selectedFile) !== null && <small className="is-source">{lessonFileSourceLabel(selectedFile)}</small>}
            </span>
          ) : (
            <span className="lesson-file-capsule is-empty">未选择文件</span>
          )}
        </div>
        <div className="lesson-files-toolbar-actions">
          {onToggleImmersive !== undefined && <button className="secondary-button" type="button" onClick={onToggleImmersive}>{immersive ? '退出沉浸阅读' : '沉浸阅读'}</button>}
          {!readOnly && !hasAnyMarkdown && (
            <>
              <span className="lesson-files-guide" role="status">本课还没有 Markdown 课件，可先导入 md 讲义或用 AI 生成第一版课件。</span>
              <button className="primary-button" type="button" disabled={busy} onClick={openNewPrep}>{draft === null ? 'AI 新建备课' : '继续上次备课'}</button>
            </>
          )}
          {!readOnly && hasAnyMarkdown && (
            <>
              <button
                className="secondary-button"
                type="button"
                disabled={busy || !canModifySelectedFile}
                title={canModifySelectedFile
                  ? `修改${selectedFile?.originalName}`
                  : '仅支持修改 Markdown 文件；外部 Office 文档请用系统应用打开修改'}
                onClick={modifySelectedFile}
              >
                ✦ 修改这份
              </button>
              {canEditSelectedFile && (
                <button className="secondary-button" type="button" aria-pressed={editing} disabled={busy} onClick={() => { setEditing((current) => !current) }}>
                  {editing ? '✓ 预览' : '✎ 编辑'}
                </button>
              )}
              {/* V19-E 接线后渲染：⬇ 导出 PDF（本节点仅占位） */}
              <AppMenuButton label="⋯" entries={menuEntries} align="right" disabled={busy} title="更多操作（本课 / 本文件）" />
            </>
          )}
          {readOnly && (
            <AppMenuButton label="⋯" entries={menuEntries} align="right" disabled={busy} title="更多操作（本文件）" />
          )}
        </div>
      </header>
      {overview === null ? (
        <div className="material-reader-state">正在读取本课次资料…</div>
      ) : (
        <LessonMaterialReader
          files={displayFiles}
          selectedFileId={selectedFileId}
          onSelectFile={setSelectedFileId}
          onOpenFile={(fileId: string) => { void openFile(fileId) }}
          editable={!readOnly}
          onFileSaved={(fileId: string) => { void handleManualEditSaved(fileId) }}
          hideTree={immersive}
          treeTitle={lesson.title}
          grouped
          currentLectureId={currentVersionFile?.id ?? null}
          editing={editing}
          onToggleEditing={() => { setEditing((current) => !current) }}
        />
      )}
      {historyFiles.length > 0 && (
        <details className="lesson-history-block">
          <summary>🕘 历史版本（{historyFiles.length}）——点开可系统打开查看，旧版永不丢失</summary>
          <ul className="lesson-history-list">
            {historyFiles.map((file) => (
              <li key={file.id}>
                <span>{file.originalName}</span>
                <button className="secondary-button" type="button" onClick={() => { void openFile(file.id) }}>系统打开</button>
              </li>
            ))}
          </ul>
          {manualEditNotes.length > 0 && (
            <p className="lesson-manual-edit-notes">
              ✎ 人工编辑：{manualEditNotes.map((note) => note.bodyMd).join('；')}
            </p>
          )}
        </details>
      )}
    </div>
  )
}
