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
  // V1.10/D62：批量管理态——树内勾选多份一次性移除（应对快速建课误导入一批）。
  const [manageMode, setManageMode] = useState(false)
  const [manageSelectedIds, setManageSelectedIds] = useState<string[]>([])
  // V19-E：课件导出 PDF（单导出串行，Main 侧 BUSY 兜底）。
  const [exportBusy, setExportBusy] = useState(false)
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
  // V1.10/D62：hover ✕ 白名单 = 全部当前资料，唯一例外是"当前讲义当前版"（唯一正文，仍只走 ⋯ 入口）。
  const removableFileIds = useMemo(() => {
    const ids = new Set(displayFiles.map((file) => file.id))
    if (currentVersionFile !== null) ids.delete(currentVersionFile.id)
    return ids
  }, [displayFiles, currentVersionFile])
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

  function toggleManageId(fileId: string): void {
    setManageSelectedIds((current) =>
      current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId])
  }

  function toggleManageMode(): void {
    setManageMode((current) => !current)
    setManageSelectedIds([])
  }

  /** V1.10/D62：批量移除——一次确认列文件名清单，随后串行 softDeleteFile（与单份同一软删语义）。 */
  async function removeSelectedFiles(): Promise<void> {
    if (lesson === null || manageSelectedIds.length === 0) return
    const targets = lessonFiles.filter((candidate) => manageSelectedIds.includes(candidate.id) && removableFileIds.has(candidate.id))
    if (targets.length === 0) { setManageMode(false); setManageSelectedIds([]); return }
    const confirmed = await confirm({
      title: `从本课移除 ${targets.length} 份资料？`,
      description: <>以下文件将从“{lesson.title}”移除：
        <ul className="confirm-file-list">{targets.map((file) => <li key={file.id}>{file.originalName}</li>)}</ul>
        只移除本课的独立副本，不会影响素材库原件或外部资料。</>,
      confirmLabel: `移除 ${targets.length} 份`,
      destructive: true,
    })
    if (!confirmed) return
    setBusy(true)
    setError('')
    setNotice('')
    let removed = 0
    try {
      for (const file of targets) {
        await window.teacherWorkbench.files.softDeleteFile({ fileId: file.id })
        removed += 1
      }
      // V1.10.1/D65：同 removeFile——先刷新列表再清选中，避免旧列表自动重选已删文件。
      await reload()
      setSelectedFileId((current) => manageSelectedIds.includes(current) ? '' : current)
      setNotice(`已从本课移除 ${removed} 份资料。`)
    } catch (removeError) {
      if (removed > 0) {
        await reload()
        setNotice(`已移除 ${removed} 份，余下未完成——${toErrorMessage(removeError, '')}`.trim())
      } else {
        setError(toErrorMessage(removeError, '课次资料读取失败，请稍后重试。'))
      }
    } finally {
      setManageMode(false)
      setManageSelectedIds([])
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
      // V1.10.1/D65：先刷新再清选中——清空选中瞬间若列表仍是旧值，阅读器自动重选会把
      // 刚软删的文件重新选中，触发注定失败的 readContent / mineru.getStatus 双请求。
      // 函数式更新：仅当此刻仍选中已删文件时才清空（await 期间用户改选了别的文件则保留）。
      await reload()
      setSelectedFileId((current) => current === fileId ? '' : current)
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

  /** V19-E：headerText = 「学生名 · 课次标题」（一对一取关联学生；班课只取课次标题；≤100 字）。 */
  function exportHeaderText(): string {
    if (prepContext === null) return ''
    const studentName = prepContext.courseMode === 'one_to_one' ? prepContext.studentNames[0] : ''
    const text = studentName === '' ? prepContext.lessonTitle : `${studentName} · ${prepContext.lessonTitle}`
    return Array.from(text).slice(0, 100).join('')
  }

  async function exportSelectedPdf(): Promise<void> {
    if (selectedFile === null || !isAiEditableFile(selectedFile) || prepContext === null) return
    setBusy(true)
    setExportBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await window.teacherWorkbench.export.printToPdf({
        fileId: selectedFile.id,
        lessonId: prepContext.lessonId,
        headerText: exportHeaderText(),
      })
      setNotice(result.saved
        ? `已导出：${selectedFile.originalName.replace(/\.md$/u, '')}.pdf`
        : '已取消导出。')
    } catch (exportError) {
      setError(toErrorMessage(exportError, '导出失败，请稍后重试。'))
    } finally {
      setExportBusy(false)
      setBusy(false)
    }
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
              <button
                className="secondary-button"
                type="button"
                disabled={busy || exportBusy || !canModifySelectedFile}
                title={canModifySelectedFile
                  ? `导出${selectedFile?.originalName}为 PDF`
                  : '仅支持导出 Markdown 文件'}
                onClick={() => { void exportSelectedPdf() }}
              >
                {exportBusy ? '导出中…' : '⬇ 导出 PDF'}
              </button>
              <AppMenuButton label="⋯" entries={menuEntries} align="right" disabled={busy} title="更多操作（本课 / 本文件）" />
            </>
          )}
          {readOnly && (
            <>
              {canModifySelectedFile && (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={busy || exportBusy}
                  title={`导出${selectedFile?.originalName}为 PDF`}
                  onClick={() => { void exportSelectedPdf() }}
                >
                  {exportBusy ? '导出中…' : '⬇ 导出 PDF'}
                </button>
              )}
              <AppMenuButton label="⋯" entries={menuEntries} align="right" disabled={busy} title="更多操作（本文件）" />
            </>
          )}
        </div>
      </header>
      {overview === null ? (
        <div className="material-reader-state">正在读取本课次资料…</div>
      ) : (
        <>
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
          onRemoveFile={!readOnly ? (fileId: string) => { void removeFile(fileId) } : undefined}
          manageMode={manageMode}
          manageSelectedIds={manageSelectedIds}
          onToggleManageId={toggleManageId}
          onToggleManageMode={!readOnly ? toggleManageMode : undefined}
          removableFileIds={removableFileIds}
        />
        {manageMode && (
          <div className="lesson-manage-bar">
            <span>已勾选 {manageSelectedIds.length} 份</span>
            <button
              className="danger-button"
              type="button"
              disabled={busy || manageSelectedIds.length === 0}
              onClick={() => { void removeSelectedFiles() }}
            >
              移除所选（{manageSelectedIds.length}）
            </button>
            <button className="secondary-button" type="button" disabled={busy} onClick={toggleManageMode}>取消</button>
          </div>
        )}
        </>
      )}
      {historyFiles.length > 0 && (
        <details className="lesson-history-block">
          <summary>🕘 历史版本（{historyFiles.length}）——点开可系统打开查看，旧版永不丢失</summary>
          <ul className="lesson-history-list">
            {historyFiles.map((file) => (
              <li key={file.id}>
                <span>{file.originalName}</span>
                <button className="secondary-button" type="button" onClick={() => { void openFile(file.id) }}>系统打开</button>
                {!readOnly && (
                  <button
                    className="material-reader-tree-remove"
                    type="button"
                    aria-label={`移除历史版本${file.originalName}`}
                    title="从本课移除这份历史版本（不影响其他版本）"
                    onClick={() => { void removeFile(file.id) }}
                  >
                    ✕
                  </button>
                )}
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
