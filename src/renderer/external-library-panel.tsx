import { useEffect, useState } from 'react'

import type {
  ExternalEntry,
  ExternalFilePreview,
  ExternalRootSummary,
} from '../shared/external-library-contracts'
import type { ManagedFileRecord } from '../shared/file-contracts'
import DocxPreview from './docx-preview'
import { MarkdownDocument } from './lesson-material-reader'
import type { LessonPrepContext } from './lesson-prep-context'
import PdfPreview from './pdf-preview'
import { formatBytes, toErrorMessage } from './ui-utils'

type EntryMap = Record<string, readonly ExternalEntry[]>

export default function ExternalLibraryPanel({
  prepContext = null,
  onAddedToLesson,
  onCancel,
}: {
  readonly prepContext?: LessonPrepContext | null
  readonly onAddedToLesson?: (file: ManagedFileRecord) => void
  /** 备课跳转模式下的“返回备课”出口；未提供时不显示返回按钮。 */
  readonly onCancel?: () => void
}): React.JSX.Element {
  const [root, setRoot] = useState<ExternalRootSummary | null>(null)
  const [entriesByFolder, setEntriesByFolder] = useState<EntryMap>({})
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedEntry, setSelectedEntry] = useState<ExternalEntry | null>(null)
  const [treeCollapsed, setTreeCollapsed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  /** V1.12（D71）：选中文件的应用内只读预览载荷；null = 加载中/不可预览态。 */
  const [preview, setPreview] = useState<ExternalFilePreview | null>(null)
  const [previewError, setPreviewError] = useState('')

  useEffect(() => {
    void loadConfiguredRoot()
  }, [])

  /**
   * V1.12（D70/D71）：选中文件即拉取预览载荷（readPreview 纯只读，响应不含路径）。
   * 预览白名单按扩展名（与 Main 推导表一致）；文件夹选中不触发。
   */
  useEffect(() => {
    if (selectedEntry === null || selectedEntry.kind !== 'file' || !isPreviewableExtension(selectedEntry.extension)) {
      setPreview(null)
      setPreviewError('')
      return
    }
    let cancelled = false
    setPreview(null)
    setPreviewError('')
    void window.teacherWorkbench.externalLibrary.readPreview({
      rootId: selectedEntry.rootId,
      relativePath: selectedEntry.relativePath,
    })
      .then((payload) => {
        if (cancelled) return
        setPreview(payload)
      })
      .catch((previewFailure: unknown) => {
        if (cancelled) return
        setPreview(null)
        setPreviewError(toErrorMessage(previewFailure, '预览加载失败，可尝试用系统应用打开。'))
      })
    return () => { cancelled = true }
  }, [selectedEntry])

  useEffect(() => {
    void loadConfiguredRoot()
  }, [])

  async function loadConfiguredRoot(): Promise<void> {
    setLoading(true)
    setError('')
    try {
      const nextRoot = await window.teacherWorkbench.externalLibrary.getRoot()
      setRoot(nextRoot)
      setEntriesByFolder({})
      setExpandedFolders(new Set())
      setSelectedEntry(null)
      if (nextRoot?.available) {
        const listing = await window.teacherWorkbench.externalLibrary.listChildren({
          rootId: nextRoot.id,
          relativePath: '',
        })
        setEntriesByFolder({ '': listing.entries })
      }
    } catch (loadError) {
      setError(toErrorMessage(loadError, '外部资料操作失败，请稍后重试。'))
    } finally {
      setLoading(false)
    }
  }

  async function chooseRoot(): Promise<void> {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const selectedRoot = await window.teacherWorkbench.externalLibrary.chooseRoot()
      if (selectedRoot === null) {
        setNotice('已取消选择。')
        return
      }
      const listing = await window.teacherWorkbench.externalLibrary.listChildren({
        rootId: selectedRoot.id,
        relativePath: '',
      })
      setRoot(selectedRoot)
      setEntriesByFolder({ '': listing.entries })
      setExpandedFolders(new Set())
      setSelectedEntry(null)
      setNotice(`已连接「${selectedRoot.name}」。`)
    } catch (chooseError) {
      setError(toErrorMessage(chooseError, '外部资料操作失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleFolder(entry: ExternalEntry): Promise<void> {
    setSelectedEntry(entry)
    if (expandedFolders.has(entry.relativePath)) {
      setExpandedFolders((current) => {
        const next = new Set(current)
        next.delete(entry.relativePath)
        return next
      })
      return
    }

    setBusy(true)
    setError('')
    try {
      let children = entriesByFolder[entry.relativePath]
      if (children === undefined) {
        const listing = await window.teacherWorkbench.externalLibrary.listChildren({
          rootId: entry.rootId,
          relativePath: entry.relativePath,
        })
        children = listing.entries
        setEntriesByFolder((current) => ({
          ...current,
          [entry.relativePath]: listing.entries,
        }))
      }
      setExpandedFolders((current) => new Set(current).add(entry.relativePath))
    } catch (folderError) {
      setError(toErrorMessage(folderError, '外部资料操作失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  async function refreshTree(): Promise<void> {
    if (root === null) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const latestRoot = await window.teacherWorkbench.externalLibrary.getRoot()
      if (latestRoot === null || latestRoot.id !== root.id) {
        await loadConfiguredRoot()
        setNotice('外部资料目录已经更改，资料树已重新载入。')
        return
      }
      if (!latestRoot.available) {
        setRoot(latestRoot)
        setEntriesByFolder({})
        setExpandedFolders(new Set())
        setSelectedEntry(null)
        setError('外部资料目录不可用，请重新选择。')
        return
      }

      const visibleFolders = ['', ...expandedFolders]
      const nextEntries: EntryMap = {}
      const nextExpanded = new Set(expandedFolders)
      for (const folderPath of visibleFolders) {
        try {
          const listing = await window.teacherWorkbench.externalLibrary.listChildren({
            rootId: latestRoot.id,
            relativePath: folderPath,
          })
          nextEntries[folderPath] = listing.entries
        } catch (refreshError) {
          if (folderPath === '') throw refreshError
          nextExpanded.delete(folderPath)
        }
      }
      setRoot(latestRoot)
      setEntriesByFolder(nextEntries)
      setExpandedFolders(nextExpanded)
      if (selectedEntry !== null && !entryStillExists(nextEntries, selectedEntry.relativePath)) {
        setSelectedEntry(null)
      }
      setNotice('资料树已刷新。')
    } catch (refreshError) {
      setError(toErrorMessage(refreshError, '外部资料操作失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  async function runFileAction(
    action: () => Promise<unknown>,
    successMessage: string,
    afterSuccess?: (result: unknown) => void,
  ): Promise<void> {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      setNotice(successMessage)
      afterSuccess?.(result)
    } catch (actionError) {
      setError(toErrorMessage(actionError, '外部资料操作失败，请稍后重试。'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <section className="workspace-card external-library-loading">正在读取外部资料设置…</section>
  }

  if (root === null) {
    return (
      <section className="workspace-card external-library-empty" aria-live="polite">
        {error !== '' && <div className="inline-error" role="alert">{error}</div>}
        {notice !== '' && <div className="inline-notice" role="status">{notice}</div>}
        <div className="placeholder-icon" aria-hidden="true">▤</div>
        <h2>选择你的外部资料目录</h2>
        <p>工作台只按需浏览这个文件夹，不会扫描整台电脑，也不会修改其中的原文件。</p>
        <button className="primary-button" type="button" onClick={() => void chooseRoot()} disabled={busy}>
          选择资料目录
        </button>
      </section>
    )
  }

  if (!root.available) {
    return (
      <section className="workspace-card external-library-empty" aria-live="polite">
        <div className="inline-error" role="alert">外部资料目录「{root.name}」当前不可用。</div>
        <p>目录可能已经移动、断开或没有读取权限，请重新选择。</p>
        <button className="primary-button" type="button" onClick={() => void chooseRoot()} disabled={busy}>
          重新选择目录
        </button>
      </section>
    )
  }

  return (
    <section className="external-library-panel" aria-label="外部资料">
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
      {notice !== '' && <div className="inline-notice" role="status">{notice}</div>}
      <div className={`external-library-layout${treeCollapsed ? ' is-tree-collapsed' : ''}`}>
        {!treeCollapsed && (
          <aside className="external-tree-panel" aria-label="外部资料树">
            <div className="external-panel-heading">
              <div>
                <p className="section-kicker">只读资料</p>
                <h2>{root.name}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="隐藏资料树"
                title="隐藏资料树"
                onClick={() => setTreeCollapsed(true)}
              >
                ‹
              </button>
            </div>
            <div className="external-tree-toolbar">
              <button className="link-button" type="button" onClick={() => void refreshTree()} disabled={busy}>
                {busy ? '读取中…' : '刷新'}
              </button>
              <button className="link-button" type="button" onClick={() => void chooseRoot()} disabled={busy}>
                更改目录
              </button>
            </div>
            <ExternalTreeBranch
              parentPath=""
              depth={0}
              entriesByFolder={entriesByFolder}
              expandedFolders={expandedFolders}
              selectedPath={selectedEntry?.relativePath ?? ''}
              busy={busy}
              onSelect={setSelectedEntry}
              onToggleFolder={toggleFolder}
            />
          </aside>
        )}

        <article className="external-content-panel">
          <div className="external-content-toolbar">
            {treeCollapsed && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => setTreeCollapsed(false)}
              >
                打开资料树
              </button>
            )}
            {prepContext !== null && onCancel !== undefined && (
              <button
                className="secondary-button"
                type="button"
                onClick={onCancel}
              >
                ← 返回备课
              </button>
            )}
            <span className="selection-label">
              {prepContext === null
                ? '外部资料只读'
                : `用于：${prepContext.lessonTitle}`}
            </span>
          </div>
          {selectedEntry === null ? (
            <div className="external-content-placeholder">
              <div className="placeholder-icon" aria-hidden="true">⌁</div>
              <h2>从资料树选择文件</h2>
              <p>文件夹按需展开；选择文件后可查看信息、打开文件或显示所在位置。</p>
            </div>
          ) : (
            <ExternalEntryDetails
              entry={selectedEntry}
              preview={preview}
              previewError={previewError}
              busy={busy}
              onOpen={() => runFileAction(
                () => window.teacherWorkbench.externalLibrary.openFile({
                  rootId: selectedEntry.rootId,
                  relativePath: selectedEntry.relativePath,
                }),
                '已交给系统应用打开。',
              )}
              onShowInFolder={() => runFileAction(
                () => window.teacherWorkbench.externalLibrary.showInFolder({
                  rootId: selectedEntry.rootId,
                  relativePath: selectedEntry.relativePath,
                }),
                '已在资源管理器中定位。',
              )}
              copyLabel={prepContext === null ? '保存到素材库' : '用于本次备课'}
              onCopy={() => prepContext === null
                ? runFileAction(
                  () => window.teacherWorkbench.externalLibrary.copyToLibrary({
                    rootId: selectedEntry.rootId,
                    relativePath: selectedEntry.relativePath,
                  }),
                  '已保存到素材库，外部原文件保持不变。',
                )
                : runFileAction(
                  () => window.teacherWorkbench.externalLibrary.copyToLesson({
                    rootId: selectedEntry.rootId,
                    relativePath: selectedEntry.relativePath,
                    lessonId: prepContext.lessonId,
                  }),
                  `已加入「${prepContext.lessonTitle}」。`,
                  (result) => onAddedToLesson?.(result as ManagedFileRecord),
                )}
            />
          )}
        </article>
      </div>
    </section>
  )
}

function ExternalTreeBranch({
  parentPath,
  depth,
  entriesByFolder,
  expandedFolders,
  selectedPath,
  busy,
  onSelect,
  onToggleFolder,
}: {
  readonly parentPath: string
  readonly depth: number
  readonly entriesByFolder: EntryMap
  readonly expandedFolders: ReadonlySet<string>
  readonly selectedPath: string
  readonly busy: boolean
  readonly onSelect: (entry: ExternalEntry) => void
  readonly onToggleFolder: (entry: ExternalEntry) => Promise<void>
}): React.JSX.Element {
  const entries = entriesByFolder[parentPath] ?? []
  if (entries.length === 0) {
    return <p className="external-tree-empty" style={{ paddingLeft: `${12 + depth * 16}px` }}>空文件夹</p>
  }

  return (
    <ul className="external-tree-list">
      {entries.map((entry) => {
        const expanded = entry.kind === 'folder' && expandedFolders.has(entry.relativePath)
        return (
          <li key={entry.relativePath}>
            <button
              className={`external-tree-row${selectedPath === entry.relativePath ? ' is-selected' : ''}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              type="button"
              aria-expanded={entry.kind === 'folder' ? expanded : undefined}
              disabled={busy}
              onClick={() => entry.kind === 'folder'
                ? void onToggleFolder(entry)
                : onSelect(entry)}
            >
              <span className="external-tree-chevron" aria-hidden="true">
                {entry.kind === 'folder' ? (expanded ? '⌄' : '›') : ''}
              </span>
              <span className="external-tree-icon" aria-hidden="true">
                {entry.kind === 'folder' ? '▰' : fileIcon(entry.extension)}
              </span>
              <span className="external-tree-name">{entry.name}</span>
            </button>
            {expanded && (
              <ExternalTreeBranch
                parentPath={entry.relativePath}
                depth={depth + 1}
                entriesByFolder={entriesByFolder}
                expandedFolders={expandedFolders}
                selectedPath={selectedPath}
                busy={busy}
                onSelect={onSelect}
                onToggleFolder={onToggleFolder}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ExternalEntryDetails({
  entry,
  preview,
  previewError,
  busy,
  onOpen,
  onShowInFolder,
  copyLabel,
  onCopy,
}: {
  readonly entry: ExternalEntry
  readonly preview: ExternalFilePreview | null
  readonly previewError: string
  readonly busy: boolean
  readonly onOpen: () => Promise<void>
  readonly onShowInFolder: () => Promise<void>
  readonly copyLabel: string
  readonly onCopy: () => Promise<void>
}): React.JSX.Element {
  const isFile = entry.kind === 'file'
  const previewable = isFile && isPreviewableExtension(entry.extension)
  const meta = preview !== null ? preview : null
  return (
    <div className="external-entry-details">
      <p className="external-breadcrumb">{formatBreadcrumb(entry.relativePath)}</p>
      <div className="external-entry-title">
        <span className="external-entry-large-icon" aria-hidden="true">
          {entry.kind === 'folder' ? '▰' : fileIcon(entry.extension)}
        </span>
        <div>
          <p className="section-kicker">{isFile ? '文件信息' : '文件夹信息'}</p>
          <h2>{entry.name}</h2>
        </div>
      </div>
      {isFile && (
        <dl className="external-metadata">
          <div><dt>类型</dt><dd>{meta !== null ? meta.mimeType : formatFileType(entry)}</dd></div>
          <div><dt>大小</dt><dd>{meta !== null ? formatBytes(meta.sizeBytes) : (entry.sizeBytes === null ? '—' : formatBytes(entry.sizeBytes))}</dd></div>
          <div><dt>修改时间</dt><dd>{formatModifiedAt(entry.modifiedAt)}</dd></div>
        </dl>
      )}
      {isFile ? (
        <>
          <div className="file-toolbar external-entry-actions">
            <button className="primary-button" type="button" onClick={() => void onCopy()} disabled={busy}>
              {copyLabel}
            </button>
            <button className="secondary-button" type="button" onClick={() => void onOpen()} disabled={busy}>
              打开文件
            </button>
            <button className="secondary-button" type="button" onClick={() => void onShowInFolder()} disabled={busy}>
              所在文件夹
            </button>
          </div>
          {previewable ? (
            <div className="external-preview" aria-label="外部资料预览">
              {previewError !== '' && <div className="inline-error" role="alert">{previewError}</div>}
              {previewError === '' && preview === null && (
                <div className="external-preview-state">正在加载预览…</div>
              )}
              {previewError === '' && preview !== null && preview.kind === 'text' && (
                entry.extension === '.md'
                  ? <MarkdownDocument body={preview.content} files={[]} />
                  : <pre className="external-preview-text">{preview.content}</pre>
              )}
              {previewError === '' && preview !== null && preview.kind === 'image' && (
                <img className="external-preview-image" src={preview.dataUrl} alt={entry.name} />
              )}
              {previewError === '' && preview !== null && preview.kind === 'binary' && preview.mimeType === 'application/pdf' && (
                <>
                  <PdfPreview dataUrl={preview.dataUrl} />
                  <div className="pdf-preview-fallback">
                    <span>需要打印或另存？</span>
                    <button className="secondary-button" type="button" onClick={() => void onOpen()}>用系统应用打开</button>
                  </div>
                </>
              )}
              {previewError === '' && preview !== null && preview.kind === 'binary' && preview.mimeType !== 'application/pdf' && (
                <>
                  <DocxPreview dataUrl={preview.dataUrl} />
                  <div className="pdf-preview-fallback">
                    <span>需要打印或另存？</span>
                    <button className="secondary-button" type="button" onClick={() => void onOpen()}>用系统应用打开</button>
                  </div>
                </>
              )}
              {previewError === '' && preview !== null && preview.kind === 'unsupported' && (
                <div className="external-preview-note">
                  <strong>这种文件暂时不能在工作台内预览</strong>
                  <p>{preview.message}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="external-preview-note">
              <strong>这类文件工作台内暂不预览</strong>
              <p>可用「打开文件」交给系统应用查看，原文件保持不变。</p>
            </div>
          )}
        </>
      ) : (
        <div className="external-preview-note">
          <strong>点击文件夹可展开或收起</strong>
          <p>目录内容按需读取，不会在后台递归扫描整个资料库。</p>
        </div>
      )}
    </div>
  )
}

function entryStillExists(entriesByFolder: EntryMap, relativePath: string): boolean {
  return Object.values(entriesByFolder).some((entries) =>
    entries.some((entry) => entry.relativePath === relativePath),
  )
}

function formatBreadcrumb(relativePath: string): string {
  return ['外部资料', ...relativePath.split(/[\\/]+/)].join(' / ')
}

function fileIcon(extension: string | null): string {
  if (extension === '.pdf') return 'P'
  if (extension === '.doc' || extension === '.docx') return 'W'
  if (extension === '.ppt' || extension === '.pptx') return 'S'
  if (extension === '.xls' || extension === '.xlsx') return 'X'
  if (extension === '.md') return 'M'
  return 'F'
}

/**
 * V1.12（D71）：渲染端预览白名单（与 Main readPreview 推导表一致）——决定选中文件是否
 * 发起 readPreview 请求。Main 侧仍是最终守卫（未知扩展名返回 unsupported）。
 */
function isPreviewableExtension(extension: string | null): boolean {
  return extension !== null && PREVIEWABLE_EXTENSIONS.has(extension)
}

const PREVIEWABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.docx', '.gif', '.jpeg', '.jpg', '.md', '.pdf', '.png', '.txt', '.webp',
])

function formatFileType(entry: ExternalEntry): string {
  if (entry.kind === 'folder') return '文件夹'
  return entry.extension === null ? '普通文件' : `${entry.extension.slice(1).toUpperCase()} 文件`
}


function formatModifiedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}
