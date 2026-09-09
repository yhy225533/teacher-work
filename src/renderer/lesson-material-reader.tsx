import { useEffect, useMemo, useState, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

import MdEditor from './md-editor'
import type { ManagedFileContent, ManagedFileRecord } from '../shared/file-contracts'
import {
  buildLessonMaterialTree,
  isSelectableLessonPrepFile,
  lessonFileSourceLabel,
  splitLessonFilesByRole,
  type LessonMaterialTreeNode,
} from './lesson-prep-context'
import { normalizeMarkdownImageReferences, normalizeRichText } from './rich-text'
import { toErrorMessage } from './ui-utils'

/**
 * V19-B（D57）：阅读器只保留正文区/树分组/题图/编辑态——文件头与操作行退役，操作并入
 * lesson-files-section 合并工具行（三主键 + ⋯ 菜单）；编辑态提升为受控（editing/onToggleEditing）。
 * onOpenFile 仅剩 unsupported 态的「用系统应用打开」按钮使用。
 */
export default function LessonMaterialReader({
  files,
  selectedFileId,
  onSelectFile,
  onOpenFile,
  editable = false,
  onFileSaved,
  hideTree = false,
  treeTitle = '本课资料',
  grouped = false,
  currentLectureId = null,
  editing = false,
  onToggleEditing,
  onRemoveFile,
  manageMode = false,
  manageSelectedIds = [],
  onToggleManageId,
  onToggleManageMode,
  removableFileIds = null,
}: {
  readonly files: readonly ManagedFileRecord[]
  readonly selectedFileId: string
  readonly onSelectFile: (fileId: string) => void
  readonly onOpenFile?: (fileId: string) => void
  readonly editable?: boolean
  /** V1.10/D62：树节点 hover ✕（editable 时传入即启用；当前讲义当前版的保护在调用方）。 */
  readonly onRemoveFile?: (fileId: string) => void
  /** V1.10/D62：批量管理态（勾选多份批量移除）。 */
  readonly manageMode?: boolean
  readonly manageSelectedIds?: readonly string[]
  readonly onToggleManageId?: (fileId: string) => void
  /** V1.10/D62：树标题「管理/完成」toggle（未传即不显示）。 */
  readonly onToggleManageMode?: () => void
  /** V1.10/D62：可移除文件白名单（null = 全部可移除；当前讲义当前版由调用方排除）。 */
  readonly removableFileIds?: ReadonlySet<string> | null
  readonly onFileSaved?: (fileId: string) => void
  readonly hideTree?: boolean
  readonly treeTitle?: string
  /** V1.8.1/D46：课件区目录树讲义/材料分组（默认不分，既有调用零改动）。 */
  readonly grouped?: boolean
  /** V1.8.1/D46：当前讲义文件 id（用于"当前"徽标；由 lesson-files-section 按版本链最新版派生）。 */
  readonly currentLectureId?: string | null
  /** V19-B（D57）：编辑态受控——工具行 ✎ 编辑主键切换。 */
  readonly editing?: boolean
  readonly onToggleEditing?: () => void
}): React.JSX.Element {
  const selectedFile = files.find((file) => file.id === selectedFileId) ?? null
  const preferredFile = useMemo(() => choosePreferredFile(files), [files])
  const [content, setContent] = useState<ManagedFileContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editSavedNotice, setEditSavedNotice] = useState('')

  useEffect(() => {
    if (selectedFile !== null) return
    if (preferredFile !== undefined && preferredFile.id !== selectedFileId) {
      onSelectFile(preferredFile.id)
    }
  }, [onSelectFile, preferredFile, selectedFile, selectedFileId])

  useEffect(() => {
    if (selectedFile === null) {
      setContent(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void window.teacherWorkbench.files.readContent({ fileId: selectedFile.id })
      .then((nextContent) => {
        if (!cancelled) setContent(nextContent)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setContent(null)
          setError(toErrorMessage(loadError, '资料正文读取失败，请稍后重试。'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedFile?.id])

  // 切换文件或树中不再可见时清除编辑提示（编辑态本体由工具行持有）
  useEffect(() => {
    setEditSavedNotice('')
  }, [selectedFileId])

  const canEditSelectedFile = editable && selectedFile !== null && selectedFile.mimeType === 'text/markdown'

  return (
    <div className={`material-reader${hideTree ? ' is-single' : ''}`}>
      {!hideTree && (
        <aside className="material-reader-tree" aria-label="本课资料目录">
          <LessonMaterialTree
            files={files}
            selectedFileId={selectedFileId}
            onSelectFile={onSelectFile}
            treeTitle={treeTitle}
            grouped={grouped}
            currentLectureId={currentLectureId}
            onRemoveFile={onRemoveFile}
            manageMode={manageMode}
            manageSelectedIds={manageSelectedIds}
            onToggleManageId={onToggleManageId}
            onToggleManageMode={onToggleManageMode}
            removableFileIds={removableFileIds}
          />
        </aside>
      )}
      <section className="material-reader-document" aria-label="资料正文">
        <div className="material-reader-scroll">
          {loading && <div className="material-reader-state">正在打开资料…</div>}
          {editSavedNotice !== '' && <div className="inline-notice" role="status">{editSavedNotice}</div>}
          {!loading && editing && canEditSelectedFile && (
            <MdEditor
              file={selectedFile}
              files={files}
              onSaved={(result) => {
                const chain = / · 第 (\d+) 版\.md$/u.test(result.file.originalName)
                setEditSavedNotice(chain
                  ? `已保存为第 ${result.version} 版《${result.file.originalName}》，旧版保留在历史版本。`
                  : `已保存为编辑版副本《${result.file.originalName}》，原件未改动。`)
                onToggleEditing?.()
                onFileSaved?.(result.file.id)
                onSelectFile(result.file.id)
              }}
              onCancel={() => { onToggleEditing?.() }}
            />
          )}
          {!loading && error !== '' && <div className="inline-error" role="alert">{error}</div>}
          {!loading && error === '' && selectedFile === null && <div className="material-reader-state">从左侧选择一份 Markdown、图片或其他资料。</div>}
          {!loading && error === '' && !editing && content?.kind === 'text' && <MarkdownDocument body={content.content} files={files} />}
          {!loading && error === '' && content?.kind === 'image' && (
            <div className="material-image-preview"><img src={content.dataUrl} alt={selectedFile?.originalName ?? '资料图片'} /></div>
          )}
          {!loading && error === '' && content?.kind === 'unsupported' && (
            <div className="material-reader-state">
              <p>{content.message}</p>
              {selectedFile !== null && onOpenFile !== undefined && <button className="primary-button" type="button" onClick={() => onOpenFile(selectedFile.id)}>用系统应用打开</button>}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export function LessonMaterialTree({
  files,
  selectedFileId,
  onSelectFile,
  selectedFileIds = [],
  onToggleFile,
  treeTitle = '本课资料',
  showHeading = true,
  grouped = false,
  currentLectureId = null,
  onRemoveFile,
  manageMode = false,
  manageSelectedIds = [],
  onToggleManageId,
  onToggleManageMode,
  removableFileIds = null,
}: {
  readonly files: readonly ManagedFileRecord[]
  readonly selectedFileId: string
  readonly onSelectFile: (fileId: string) => void
  readonly selectedFileIds?: readonly string[]
  readonly onToggleFile?: (fileId: string) => void
  readonly treeTitle?: string
  readonly showHeading?: boolean
  readonly grouped?: boolean
  readonly currentLectureId?: string | null
  /** V1.10/D62：hover ✕ 移除回调（未传即不渲染 ✕）。 */
  readonly onRemoveFile?: (fileId: string) => void
  /** V1.10/D62：批量管理态——树内 checkbox 切换为管理勾选。 */
  readonly manageMode?: boolean
  readonly manageSelectedIds?: readonly string[]
  readonly onToggleManageId?: (fileId: string) => void
  /** V1.10/D62：树标题右侧「管理/完成」toggle（未传即不显示）。 */
  readonly onToggleManageMode?: () => void
  /** V1.10/D62：可移除文件白名单（null = 全部可移除；当前讲义当前版由调用方排除）。 */
  readonly removableFileIds?: ReadonlySet<string> | null
}): React.JSX.Element {
  const markdownFiles = useMemo(
    () => files.filter((file) => file.mimeType === 'text/markdown'),
    [files],
  )
  const markdownSnapshot = markdownFiles
    .map((file) => `${file.id}:${file.contentHash ?? ''}`)
    .join('|')
  const [markdownBodies, setMarkdownBodies] = useState<ReadonlyMap<string, string>>(new Map())
  const [expandedFileIds, setExpandedFileIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    if (markdownFiles.length === 0) {
      setMarkdownBodies(new Map())
      return () => { cancelled = true }
    }
    void Promise.all(markdownFiles.map(async (file) => {
      try {
        const content = await window.teacherWorkbench.files.readContent({ fileId: file.id })
        return content.kind === 'text' ? [file.id, content.content] as const : null
      } catch {
        return null
      }
    })).then((entries) => {
      if (cancelled) return
      setMarkdownBodies(new Map(entries.filter((entry): entry is readonly [string, string] => entry !== null)))
    })
    return () => { cancelled = true }
  }, [markdownSnapshot])

  const nodes = useMemo(
    () => buildLessonMaterialTree(files, markdownBodies),
    [files, markdownBodies],
  )
  const treeSnapshot = nodes.map((node) => `${node.file.id}:${node.children.map((child) => child.id).join(',')}`).join('|')

  /** V1.8.1/D46：方案 A 分组——讲义组在前、材料组在后；纯展示层切分，不动文件树构建。 */
  const groupedNodes = useMemo(() => {
    if (!grouped) return null
    const byRole = splitLessonFilesByRole(nodes.map((node) => node.file))
    const lectureIds = new Set(byRole.lecture.map((file) => file.id))
    return {
      lecture: nodes.filter((node) => lectureIds.has(node.file.id)),
      materials: nodes.filter((node) => !lectureIds.has(node.file.id)),
    }
  }, [grouped, nodes])

  useEffect(() => {
    setExpandedFileIds((current) => {
      const expandableIds = new Set(
        nodes.filter((node) => node.children.length > 0).map((node) => node.file.id),
      )
      return new Set([...current].filter((fileId) => expandableIds.has(fileId)))
    })
  }, [treeSnapshot])

  function toggleExpanded(fileId: string): void {
    setExpandedFileIds((current) => {
      const next = new Set(current)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  return (
    <div className="material-reader-tree-content">
      {showHeading && (
        <div className="material-reader-tree-heading">
          <span className="material-reader-folder-icon" aria-hidden="true">▾</span>
          <strong>{treeTitle}</strong>
          <small>{files.length} 项</small>
          {onToggleManageMode !== undefined && (
            <button className="tree-manage-toggle" type="button" aria-pressed={manageMode} onClick={onToggleManageMode}>
              {manageMode ? '✓ 完成' : '管理'}
            </button>
          )}
        </div>
      )}
      <ul className="material-reader-tree-list">
        {groupedNodes === null
          ? nodes.map((node) => (
            <MaterialTreeNodeRow
              key={node.file.id}
              node={node}
              selectedFileId={selectedFileId}
              selectedFileIds={selectedFileIds}
              expanded={expandedFileIds.has(node.file.id)}
              canSelect={onToggleFile !== undefined && isSelectableLessonPrepFile(node.file)}
              onSelectFile={onSelectFile}
              onToggleFile={onToggleFile}
              onToggleExpanded={toggleExpanded}
              onRemoveFile={onRemoveFile}
              manageMode={manageMode}
              manageSelectedIds={manageSelectedIds}
              onToggleManageId={onToggleManageId}
              removableFileIds={removableFileIds}
            />
          ))
          : (
            <li className="material-role-group" aria-label="本课讲义分组">
              <div className="material-role-group-title"><span aria-hidden="true">📘</span>本课讲义<small>{groupedNodes.lecture.length} 项</small></div>
              {groupedNodes.lecture.length === 0 && (
                <p className="material-role-group-empty">还没有讲义——选中材料区的 Markdown 可「设为讲义底稿」，或用 AI 生成第一版课件。</p>
              )}
              <ul>
                {groupedNodes.lecture.map((node) => (
                  <MaterialTreeNodeRow
                    key={node.file.id}
                    node={node}
                    selectedFileId={selectedFileId}
                    selectedFileIds={selectedFileIds}
                    expanded={expandedFileIds.has(node.file.id)}
                    canSelect={onToggleFile !== undefined && isSelectableLessonPrepFile(node.file)}
                    onSelectFile={onSelectFile}
                    onToggleFile={onToggleFile}
                    onToggleExpanded={toggleExpanded}
                    isCurrentLecture={node.file.id === currentLectureId}
                    onRemoveFile={onRemoveFile}
                    manageMode={manageMode}
                    manageSelectedIds={manageSelectedIds}
                    onToggleManageId={onToggleManageId}
                    removableFileIds={removableFileIds}
                  />
                ))}
              </ul>
            </li>
          )}
        {groupedNodes !== null && (
          <li className="material-role-group" aria-label="本课材料分组">
            <div className="material-role-group-title"><span aria-hidden="true">📎</span>本课材料<small>{groupedNodes.materials.length} 项</small></div>
            {groupedNodes.materials.length === 0 && (
              <p className="material-role-group-empty">本课还没有材料。</p>
            )}
            <ul>
              {groupedNodes.materials.map((node) => (
                <MaterialTreeNodeRow
                  key={node.file.id}
                  node={node}
                  selectedFileId={selectedFileId}
                  selectedFileIds={selectedFileIds}
                  expanded={expandedFileIds.has(node.file.id)}
                  canSelect={onToggleFile !== undefined && isSelectableLessonPrepFile(node.file)}
                  onSelectFile={onSelectFile}
                  onToggleFile={onToggleFile}
                  onToggleExpanded={toggleExpanded}
                  sourceLabel={lessonFileSourceLabel(node.file)}
                    onRemoveFile={onRemoveFile}
                    manageMode={manageMode}
                    manageSelectedIds={manageSelectedIds}
                    onToggleManageId={onToggleManageId}
                    removableFileIds={removableFileIds}
                />
              ))}
            </ul>
          </li>
        )}
      </ul>
      {files.length === 0 && <p className="empty-state">本课次还没有资料。</p>}
    </div>
  )
}

function MaterialTreeNodeRow({
  node,
  selectedFileId,
  selectedFileIds,
  expanded,
  canSelect,
  onSelectFile,
  onToggleFile,
  onToggleExpanded,
  isCurrentLecture = false,
  sourceLabel = null,
  onRemoveFile,
  manageMode = false,
  manageSelectedIds = [],
  onToggleManageId,
  removableFileIds = null,
}: {
  readonly node: LessonMaterialTreeNode
  readonly selectedFileId: string
  readonly selectedFileIds: readonly string[]
  readonly expanded: boolean
  readonly canSelect: boolean
  readonly onSelectFile: (fileId: string) => void
  readonly onToggleFile?: (fileId: string) => void
  readonly onToggleExpanded: (fileId: string) => void
  /** V1.8.1/D46：讲义组"当前"徽标。 */
  readonly isCurrentLecture?: boolean
  /** V1.8.1/D46：材料组来源标签（外部/素材库；工作台产物为 null 不显示）。 */
  readonly sourceLabel?: string | null
  /** V1.10/D62：hover ✕（onRemoveFile 存在且文件在 removableFileIds 白名单内才渲染）。 */
  readonly onRemoveFile?: (fileId: string) => void
  readonly manageMode?: boolean
  readonly manageSelectedIds?: readonly string[]
  readonly onToggleManageId?: (fileId: string) => void
  readonly removableFileIds?: ReadonlySet<string> | null
}): React.JSX.Element {
  const hasChildren = node.children.length > 0
  const canRemove = onRemoveFile !== undefined && (removableFileIds === null || removableFileIds.has(node.file.id))
  return (
    <li className="material-reader-tree-node">
      <div className="material-reader-tree-row">
        {manageMode ? (
          <input
            aria-label={`勾选移除${node.file.originalName}`}
            type="checkbox"
            checked={manageSelectedIds.includes(node.file.id)}
            onChange={() => onToggleManageId?.(node.file.id)}
          />
        ) : hasChildren ? (
          <button
            className="material-reader-tree-toggle"
            type="button"
            aria-label={`${expanded ? '收起' : '展开'}${displayFileName(node.file.originalName)}的素材`}
            aria-expanded={expanded}
            onClick={() => onToggleExpanded(node.file.id)}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : <span className="material-reader-tree-toggle-spacer" aria-hidden="true" />}
        {canSelect && (
          <input
            aria-label={`选择${node.file.originalName}作为生成资料`}
            type="checkbox"
            checked={selectedFileIds.includes(node.file.id)}
            onChange={() => onToggleFile?.(node.file.id)}
          />
        )}
        <button
          className={`material-reader-tree-file${selectedFileId === node.file.id ? ' is-selected' : ''}`}
          type="button"
          onClick={() => onSelectFile(node.file.id)}
        >
          <span className="material-file-icon" aria-hidden="true">{fileIcon(node.file)}</span>
          <span>{displayFileName(node.file.originalName)}</span>
          {isCurrentLecture && <small className="material-role-badge is-current">当前</small>}
          {sourceLabel !== null && <small className="material-role-badge is-source">{sourceLabel}</small>}
          {hasChildren && <small>{node.children.length}</small>}
        </button>
        {!manageMode && canRemove && (
          <button
            className="material-reader-tree-remove"
            type="button"
            aria-label={`移除${node.file.originalName}`}
            title="从本课移除（素材库/外部原件不受影响）"
            onClick={() => onRemoveFile?.(node.file.id)}
          >
            ✕
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <ul className="material-reader-tree-children">
          {node.children.map((child) => (
            <li key={child.id}>
              <button
                className={`material-reader-tree-file material-reader-tree-child${selectedFileId === child.id ? ' is-selected' : ''}`}
                type="button"
                onClick={() => onSelectFile(child.id)}
              >
                <span className="material-file-icon" aria-hidden="true">{fileIcon(child)}</span>
                <span>{displayFileName(child.originalName)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function fileIcon(file: ManagedFileRecord): string {
  if (file.mimeType.startsWith('image/')) return '▧'
  if (file.mimeType === 'text/markdown') return '▤'
  return '▱'
}

export function MarkdownDocument({ body, files }: {
  readonly body: string
  readonly files: readonly ManagedFileRecord[]
}): React.JSX.Element {
  const blocks = parseBlocks(body)
  return (
    <article className="material-markdown">
      {blocks.map((block, index) => renderBlock(block, index, files))}
    </article>
  )
}

type MarkdownBlock =
  | { readonly type: 'heading'; readonly level: number; readonly text: string }
  | { readonly type: 'paragraph'; readonly lines: readonly string[] }
  | { readonly type: 'bullet'; readonly lines: readonly string[] }
  | { readonly type: 'numbered'; readonly lines: readonly string[] }
  | { readonly type: 'quote'; readonly lines: readonly string[] }
  | { readonly type: 'code'; readonly language: string; readonly lines: readonly string[] }
  | { readonly type: 'table'; readonly rows: readonly (readonly string[])[] }
  | { readonly type: 'rule' }

function parseBlocks(body: string): MarkdownBlock[] {
  const lines = normalizeMarkdownImageReferences(body).split('\n')
  const blocks: MarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const sourceLine = lines[index]
    const line = sourceLine.trim()
    if (line === '') {
      index += 1
      continue
    }
    const fence = /^```\s*([\w-]*)\s*$/u.exec(line)
    if (fence !== null) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/u.test(lines[index].trim())) {
        codeLines.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push({ type: 'code', language: fence[1], lines: codeLines })
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line)
    if (heading !== null) {
      blocks.push({ type: 'heading', level: Math.min(heading[1].length, 6), text: heading[2] })
      index += 1
      continue
    }
    if (/^(?:---+|\*\*\*+|___+)$/u.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/u, ''))
        index += 1
      }
      blocks.push({ type: 'quote', lines: quoteLines })
      continue
    }
    if (/^[-*+]\s+/u.test(line)) {
      const listLines: string[] = []
      while (index < lines.length && /^\s*[-*+]\s+/u.test(lines[index])) {
        listLines.push(lines[index].trim().replace(/^[-*+]\s+/u, ''))
        index += 1
      }
      blocks.push({ type: 'bullet', lines: listLines })
      continue
    }
    if (/^\d+[.、)]\s*/u.test(line)) {
      const listLines: string[] = []
      while (index < lines.length && /^\s*\d+[.、)]\s*/u.test(lines[index])) {
        listLines.push(lines[index].trim().replace(/^\d+[.、)]\s*/u, ''))
        index += 1
      }
      blocks.push({ type: 'numbered', lines: listLines })
      continue
    }
    if (isTableHeader(lines, index)) {
      const rows: string[][] = [splitTableRow(lines[index])]
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      blocks.push({ type: 'table', rows })
      continue
    }
    const paragraphLines = [sourceLine.trimStart()]
    index += 1
    while (index < lines.length && lines[index].trim() !== '' && !isBlockStart(lines[index].trim())) {
      paragraphLines.push(lines[index].trimStart())
      index += 1
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines })
  }
  return blocks
}

function renderBlock(block: MarkdownBlock, key: number, files: readonly ManagedFileRecord[]): React.JSX.Element {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.max(1, Math.min(block.level, 6))}` as keyof React.JSX.IntrinsicElements
      return <Tag key={key}>{renderInline(block.text, files, `${key}-heading`)}</Tag>
    }
    case 'paragraph':
      return <p key={key}>{renderParagraphLines(block.lines, files, `${key}-paragraph`)}</p>
    case 'bullet':
      return <ul key={key}>{block.lines.map((line, index) => <li key={index}>{renderInline(line, files, `${key}-bullet-${index}`)}</li>)}</ul>
    case 'numbered':
      return <ol key={key}>{block.lines.map((line, index) => <li key={index}>{renderInline(line, files, `${key}-numbered-${index}`)}</li>)}</ol>
    case 'quote':
      return <blockquote key={key}>{block.lines.map((line, index) => <p key={index}>{renderInline(line, files, `${key}-quote-${index}`)}</p>)}</blockquote>
    case 'code':
      return <pre key={key} data-language={block.language}><code>{block.lines.join('\n')}</code></pre>
    case 'table':
      return <table key={key}><thead><tr>{block.rows[0]?.map((cell, index) => <th key={index}>{renderInline(cell, files, `${key}-th-${index}`)}</th>)}</tr></thead><tbody>{block.rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{renderInline(cell, files, `${key}-td-${rowIndex}-${index}`)}</td>)}</tr>)}</tbody></table>
    case 'rule':
      return <hr key={key} />
  }
}

function renderParagraphLines(
  lines: readonly string[],
  files: readonly ManagedFileRecord[],
  keyPrefix: string,
): ReactNode[] {
  const nodes: ReactNode[] = []
  // 显示公式 \[ ... \] 常跨多行（\[ 与 \] 各占一行）；逐行渲染会拆散定界符，
  // 先把跨行公式合并回单行（软换行本就以空格衔接，语义不变）。
  const mergedLines: string[] = []
  let mathBuffer: string | null = null
  for (const line of lines) {
    if (mathBuffer === null) {
      if (/\\\[/u.test(line) && !/\\\]/u.test(line)) {
        mathBuffer = line
      } else {
        mergedLines.push(line)
      }
    } else {
      mathBuffer += ` ${line}`
      if (/\\\]/u.test(line)) {
        mergedLines.push(mathBuffer)
        mathBuffer = null
      }
    }
  }
  if (mathBuffer !== null) mergedLines.push(mathBuffer)
  for (let index = 0; index < mergedLines.length; index += 1) {
    const sourceLine = mergedLines[index]
    const hardBreak = /(?: {2,}|\\)$/u.test(sourceLine)
    const line = hardBreak ? sourceLine.replace(/(?: {2,}|\\)$/u, '') : sourceLine
    nodes.push(...renderInline(line, files, `${keyPrefix}-${index}`))
    if (index < mergedLines.length - 1) {
      nodes.push(hardBreak ? <br key={`${keyPrefix}-break-${index}`} /> : ' ')
    }
  }
  return nodes
}

function renderInline(text: string, files: readonly ManagedFileRecord[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const normalizedText = normalizeInlineMarkdownText(text)
  const pattern = /(!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|`[^`]+`|\\\([^\n]+?\\\)|\\\[[^\n]+?\\\]|\$\$[^$]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/gu
  let cursor = 0
  let match: RegExpExecArray | null
  let tokenIndex = 0
  while ((match = pattern.exec(normalizedText)) !== null) {
    if (match.index > cursor) nodes.push(normalizedText.slice(cursor, match.index))
    const token = match[0]
    const key = `${keyPrefix}-${tokenIndex}`
    if (token.startsWith('![')) {
      const image = /^!\[([^\]]*)\]\(([^)]+)\)$/u.exec(token)
      const file = image === null ? undefined : findReferencedFile(files, image[2])
      nodes.push(file === undefined ? image?.[1] ?? token : <ManagedMarkdownImage key={key} file={file} alt={image?.[1] ?? ''} />)
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(token)
      const href = link?.[2].trim()
      nodes.push(href !== undefined && /^https?:\/\//iu.test(href)
        ? <a key={key} href={href} target="_blank" rel="noreferrer">{link?.[1]}</a>
        : link?.[1] ?? token)
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('$$')) {
      nodes.push(<MathSpan key={key} formula={token.slice(2, -2)} display />)
    } else if (token.startsWith('\\[')) {
      // \[...\] 显示公式：修复前该 token 掉进斜体分支被剥掉首尾字符、以纯文本漏出。
      nodes.push(<MathSpan key={key} formula={token.slice(2, -2)} display />)
    } else if (token.startsWith('$') || token.startsWith('\\(')) {
      nodes.push(<MathSpan key={key} formula={token.startsWith('\\(') ? token.slice(2, -2) : token.slice(1, -1)} />)
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), files, key)}</strong>)
    } else {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), files, key)}</em>)
    }
    cursor = match.index + token.length
    tokenIndex += 1
  }
  if (cursor < normalizedText.length) nodes.push(normalizedText.slice(cursor))
  return nodes
}

function normalizeInlineMarkdownText(text: string): string {
  const tokenMarker = '\uE000'
  const protectedTokens: string[] = []
  const protectedText = normalizeMarkdownImageReferences(text).replace(
    /(!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|`[^`]+`)/gu,
    (token) => {
      const index = protectedTokens.push(token) - 1
      return `${tokenMarker}${index}${tokenMarker}`
    },
  )
  const tokenPattern = new RegExp(`${tokenMarker}(\\d+)${tokenMarker}`, 'gu')
  return normalizeRichText(protectedText).replace(tokenPattern, (_match, index: string) => protectedTokens[Number(index)] ?? '')
}

/** V1.7.3（D37）：公式内容 → 渲染 HTML 的 LRU 缓存（MarkText 做法）——输入时未变的公式直接复用，不重跑 KaTeX。 */
const MATH_HTML_CACHE_MAX = 300
const mathHtmlCache = new Map<string, string>()

function renderMathHtml(formula: string, display: boolean): string {
  const key = `${display ? 'D' : 'I'}\u0001${formula}`
  const cached = mathHtmlCache.get(key)
  if (cached !== undefined) {
    mathHtmlCache.delete(key)
    mathHtmlCache.set(key, cached) // LRU 触碰：移到队尾
    return cached
  }
  let html: string
  try {
    html = katex.renderToString(formula, { displayMode: display, throwOnError: true })
  } catch (error) {
    // 思源 mathRender.ts 同款降级：红色显示 KaTeX 错误消息，而不是整段回源码
    const message = error instanceof Error ? error.message : String(error)
    html = `<span class="math-error" title="${escapeHtml(formula)}">⚠ ${escapeHtml(message)}</span>`
  }
  mathHtmlCache.set(key, html)
  if (mathHtmlCache.size > MATH_HTML_CACHE_MAX) {
    mathHtmlCache.delete(mathHtmlCache.keys().next().value ?? '')
  }
  return html
}

function escapeHtml(text: string): string {
  return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;')
}

function MathSpan({ formula, display = false }: { readonly formula: string; readonly display?: boolean }): React.JSX.Element {
  try {
    const normalizedFormula = formula
      .replace(/\u200B|\u200C|\u200D|\uFEFF/gu, '')
      .trim()
      .replace(/^\$([^$\n]+)\$$/u, '$1')
    return <span className={display ? 'material-math material-math-display' : 'material-math'} dangerouslySetInnerHTML={{ __html: renderMathHtml(normalizedFormula, display) }} />
  } catch {
    return <code>{formula}</code>
  }
}

function ManagedMarkdownImage({ file, alt }: { readonly file: ManagedFileRecord; readonly alt: string }): React.JSX.Element {
  const [content, setContent] = useState<ManagedFileContent | null>(null)
  useEffect(() => {
    let cancelled = false
    void window.teacherWorkbench.files.readContent({ fileId: file.id }).then((next) => {
      if (!cancelled) setContent(next)
    }).catch(() => {
      if (!cancelled) setContent(null)
    })
    return () => { cancelled = true }
  }, [file.id])
  if (content?.kind === 'image') return <img className="material-markdown-image" src={content.dataUrl} alt={alt || file.originalName} />
  return <span className="material-image-missing">{alt || file.originalName}</span>
}

function isTableHeader(lines: readonly string[], index: number): boolean {
  return index + 1 < lines.length && lines[index].includes('|') && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(lines[index + 1])
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/u, '').replace(/\|$/u, '').split('|').map((cell) => cell.trim())
}

function isBlockStart(line: string): boolean {
  return /^(?:#{1,6}\s|```|[-*+]\s|\d+[.、)]\s|>|---+$|\*\*\*+$|___+$)/u.test(line)
}

function findReferencedFile(files: readonly ManagedFileRecord[], reference: string): ManagedFileRecord | undefined {
  const rawReference = reference.trim().split(/[?#]/u)[0]
  const withoutTitle = rawReference.split(/\s+['"]/u)[0]
  const name = withoutTitle.startsWith('<') && withoutTitle.endsWith('>')
    ? withoutTitle.slice(1, -1)
    : withoutTitle
  let normalized = name.split(/[\\/]/u).at(-1) ?? ''
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // Keep the original path when a malformed escape appears in a document.
  }
  normalized = normalized.toLocaleLowerCase('zh-CN')
  if (normalized === undefined || normalized === '') return undefined
  return files.find((file) => file.originalName.toLocaleLowerCase('zh-CN') === normalized)
}

function choosePreferredFile(files: readonly ManagedFileRecord[]): ManagedFileRecord | undefined {
  const markdown = [...files]
    .filter((file) => file.mimeType === 'text/markdown')
    .sort((left, right) => right.sizeBytes - left.sizeBytes)[0]
  if (markdown !== undefined) return markdown
  return [...files]
    .filter((file) => file.mimeType.startsWith('image/'))
    .sort((left, right) => right.sizeBytes - left.sizeBytes)[0] ?? files[0]
}

function displayFileName(name: string): string {
  return name.replace(/\.(?:md|markdown|txt)$/iu, '')
}
