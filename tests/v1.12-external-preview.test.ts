import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ExternalLibraryService } from '../src/main/external/external-library-service'
import {
  dispatchExternalLibraryIpc,
  type ExternalLibraryIpcDependencies,
} from '../src/main/ipc/external-library-ipc'
import { EXTERNAL_LIBRARY_IPC_CHANNELS } from '../src/shared/ipc-contracts'
import {
  isExternalFilePreview,
  type ExternalPathRequest,
} from '../src/shared/external-library-contracts'
import { initializeWorkspace, type WorkspaceHandle } from '../src/main/workspace/workspace-service'

/** V1.12（D70/D71）：外部资料只读预览——service 四分支 + 路径安全 + IPC case + 渲染端钉测。 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const temporaryRoots: string[] = []
const workspaces: WorkspaceHandle[] = []

afterEach(() => {
  for (const workspace of workspaces.splice(0)) workspace.close()
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createPreviewFixture(): {
  readonly libraryRoot: string
  readonly service: ExternalLibraryService
  readonly rootId: string
} {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'teacher-workbench-v112b-'))
  temporaryRoots.push(fixtureRoot)
  const libraryRoot = join(fixtureRoot, '公共资料')
  mkdirSync(libraryRoot, { recursive: true })
  writeFileSync(join(libraryRoot, '有理数要点.md'), '# 有理数要点\n\n要点正文。', 'utf8')
  writeFileSync(join(libraryRoot, '练习卷.pdf'), Buffer.from('%PDF-1.4 smoke pdf bytes'))
  writeFileSync(join(libraryRoot, '讲义.docx'), Buffer.from('PK-docx-fixture-bytes'))
  writeFileSync(join(libraryRoot, '题图.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
  writeFileSync(join(libraryRoot, '笔记.txt'), '纯文本笔记', 'utf8')
  writeFileSync(join(libraryRoot, '旧试卷.doc'), Buffer.from('legacy-msword'))
  const workspace = initializeWorkspace(join(fixtureRoot, 'workspace'), join(fixtureRoot, 'install'))
  workspaces.push(workspace)
  const service = new ExternalLibraryService(workspace.database.raw, {
    idFactory: () => 'external-root-1',
    now: () => '2026-09-10T00:00:00.000Z',
  })
  const root = service.setRoot(libraryRoot)
  return { libraryRoot, service, rootId: root.id }
}

describe('V112-B external service readPreview (D70)', () => {
  it('md/text files return the text branch with utf8 content and markdown mime', () => {
    const { service, rootId } = createPreviewFixture()
    const md = service.readPreview(rootId, '有理数要点.md')
    expect(md.kind).toBe('text')
    if (md.kind !== 'text') throw new Error('narrow')
    expect(md.mimeType).toBe('text/markdown')
    expect(md.content).toContain('要点正文')
    expect(md.name).toBe('有理数要点.md')

    const txt = service.readPreview(rootId, '笔记.txt')
    expect(txt.kind).toBe('text')
    expect(txt.mimeType).toBe('text/plain')
  })

  it('png returns the image dataUrl branch; pdf/docx return the binary dataUrl branch', () => {
    const { service, rootId } = createPreviewFixture()
    const png = service.readPreview(rootId, '题图.png')
    expect(png.kind).toBe('image')
    if (png.kind !== 'image' && png.kind !== 'binary') throw new Error('narrow')
    expect(png.dataUrl.startsWith('data:image/png;base64,')).toBe(true)

    const pdf = service.readPreview(rootId, '练习卷.pdf')
    expect(pdf.kind).toBe('binary')
    if (pdf.kind !== 'binary' && pdf.kind !== 'image') throw new Error('narrow')
    expect(pdf.mimeType).toBe('application/pdf')
    expect(pdf.dataUrl.startsWith('data:application/pdf;base64,')).toBe(true)

    const docx = service.readPreview(rootId, '讲义.docx')
    expect(docx.kind).toBe('binary')
    expect(docx.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  })

  it('.doc and unknown extensions stay on unsupported; oversize files stay on the limit message', () => {
    const { service, rootId, libraryRoot } = createPreviewFixture()
    const doc = service.readPreview(rootId, '旧试卷.doc')
    expect(doc.kind).toBe('unsupported')
    if (doc.kind !== 'unsupported') throw new Error('narrow')
    expect(doc.mimeType).toBe('application/msword')
    expect(doc.message).toContain('系统应用打开')

    const large = Buffer.alloc(12 * 1024 * 1024 + 1, 0)
    writeFileSync(join(libraryRoot, '大文件.pdf'), large)
    const oversize = service.readPreview(rootId, '大文件.pdf')
    expect(oversize.kind).toBe('unsupported')
    if (oversize.kind !== 'unsupported') throw new Error('narrow')
    expect(oversize.message).toContain('文件较大')
  })

  it('path safety: traversal, root mismatch and folder selections are rejected', () => {
    const { service, rootId } = createPreviewFixture()
    expect(() => service.readPreview(rootId, '../逃逸.pdf')).toThrow()
    expect(() => service.readPreview('not-the-root', '有理数要点.md')).toThrow()
    // 根目录本身（relativePath ''）不是文件 → EXTERNAL_ENTRY_NOT_FILE
    expect(() => service.readPreview(rootId, '')).toThrow()
  })

  it('guard isExternalFilePreview: branch fields + forged dataUrl rejection', () => {
    const meta = { name: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 10 }
    expect(isExternalFilePreview({ ...meta, kind: 'text', content: 'x' })).toBe(true)
    expect(isExternalFilePreview({ ...meta, kind: 'binary', dataUrl: 'data:application/pdf;base64,JVBERg==' })).toBe(true)
    expect(isExternalFilePreview({ ...meta, kind: 'binary', dataUrl: 'http://evil' })).toBe(false)
    expect(isExternalFilePreview({ ...meta, kind: 'unsupported', message: '不支持' })).toBe(true)
    expect(isExternalFilePreview({ ...meta, kind: 'unsupported', message: '' })).toBe(false)
    expect(isExternalFilePreview({ name: '', mimeType: 'application/pdf', sizeBytes: 10, kind: 'text', content: 'x' })).toBe(false)
  })
})

describe('V112-B external library IPC readPreview case (D70)', () => {
  it('dispatch returns a guarded success payload for a previewable file', async () => {
    const { service, rootId } = createPreviewFixture()
    const dependencies: ExternalLibraryIpcDependencies = {
      getService: () => service,
      getManagedFileService: () => {
        throw new Error('readPreview must not touch the managed file service')
      },
      chooseRootPath: () => Promise.resolve(null),
      openPath: () => Promise.resolve(''),
      showInFolder: () => undefined,
    }
    const request: ExternalPathRequest = { rootId, relativePath: '练习卷.pdf' }
    const response = await dispatchExternalLibraryIpc(
      EXTERNAL_LIBRARY_IPC_CHANNELS.readPreview,
      request,
      dependencies,
      { log: () => undefined, error: () => undefined } as never,
    )
    expect(response.ok).toBe(true)
    if (!response.ok) throw new Error('narrow')
    const payload = response.data as { kind: string; mimeType: string }
    expect(payload.kind).toBe('binary')
    expect(payload.mimeType).toBe('application/pdf')
  })

  it('dispatch rejects invalid payloads and unknown files without leaking paths', async () => {
    const { service, rootId, libraryRoot } = createPreviewFixture()
    const dependencies: ExternalLibraryIpcDependencies = {
      getService: () => service,
      getManagedFileService: () => {
        throw new Error('unused')
      },
      chooseRootPath: () => Promise.resolve(null),
      openPath: () => Promise.resolve(''),
      showInFolder: () => undefined,
    }
    const invalid = await dispatchExternalLibraryIpc(
      EXTERNAL_LIBRARY_IPC_CHANNELS.readPreview,
      { rootId, relativePath: 123 },
      dependencies,
      { log: () => undefined, error: () => undefined } as never,
    )
    expect(invalid.ok).toBe(false)

    const missing = await dispatchExternalLibraryIpc(
      EXTERNAL_LIBRARY_IPC_CHANNELS.readPreview,
      { rootId, relativePath: '不存在.pdf' },
      dependencies,
      { log: () => undefined, error: () => undefined } as never,
    )
    expect(missing.ok).toBe(false)
    if (missing.ok) throw new Error('narrow')
    expect(JSON.stringify(missing.error)).not.toContain(libraryRoot)
  })
})

describe('V112-B external panel preview wiring (D71)', () => {
  it('panel: static imports of shared preview components, preview-first details, V1.1 note retired', () => {
    const panel = source('../src/renderer/external-library-panel.tsx')
    // 渲染器边界：静态导入复用组件（无 dynamic import/require）
    expect(panel).toContain("import DocxPreview from './docx-preview'")
    expect(panel).toContain("import { MarkdownDocument } from './lesson-material-reader'")
    expect(panel).toContain("import PdfPreview from './pdf-preview'")
    expect(panel).not.toContain('import(')
    // 选中文件 → readPreview 请求（纯只读载荷通道）
    expect(panel).toContain('externalLibrary.readPreview')
    // 四分支渲染 + 逃生门
    expect(panel).toContain("preview.kind === 'text'")
    expect(panel).toContain("preview.kind === 'image'")
    expect(panel).toContain("preview.kind === 'binary' && preview.mimeType === 'application/pdf'")
    expect(panel).toContain('<PdfPreview dataUrl={preview.dataUrl} />')
    expect(panel).toContain('<DocxPreview dataUrl={preview.dataUrl} />')
    expect(panel).toContain('<MarkdownDocument body={preview.content} files={[]} />')
    expect(panel).toContain('用系统应用打开')
    // V1.1 时代说明退役（与现状不符）
    expect(panel).not.toContain('V1.1 不模拟')
  })

  it('panel keeps non-previewable extensions (.doc/.pptx/.xlsx) out of the preview whitelist', () => {
    const panel = source('../src/renderer/external-library-panel.tsx')
    expect(panel).toContain('PREVIEWABLE_EXTENSIONS')
    const setMatch = /const PREVIEWABLE_EXTENSIONS[^=]*= new Set\(\[([^\]]+)\]\)/u.exec(panel)
    expect(setMatch).not.toBeNull()
    const members = setMatch === null ? '' : setMatch[1]
    for (const allowed of ["'.docx'", "'.gif'", "'.jpeg'", "'.jpg'", "'.md'", "'.pdf'", "'.png'", "'.txt'", "'.webp'"]) {
      expect(members).toContain(allowed)
    }
    for (const forbidden of ["'.doc'", "'.ppt'", "'.pptx'", "'.xls'", "'.xlsx'"]) {
      expect(members).not.toContain(forbidden)
    }
  })

  it('styles: external preview container group present', () => {
    const styles = source('../src/renderer/styles.css')
    expect(styles).toContain('.external-preview {')
    expect(styles).toContain('.external-preview-text')
    expect(styles).toContain('.external-preview-image')
    expect(styles).toContain('.external-preview-state')
  })

  it('main service whitelist mirrors the managed preview semantics (pdf/docx only for binary)', () => {
    const service = source('../src/main/external/external-library-service.ts')
    expect(service).toContain('function isExternalPreviewableBinary')
    // 白名单函数只认 pdf/docx；msword 仅出现在推导表（.doc → unsupported），不进 binary
    const fnMatch = /function isExternalPreviewableBinary\(mimeType: string\): boolean \{[^}]*\}/u.exec(service)
    expect(fnMatch).not.toBeNull()
    const fnBody = fnMatch === null ? '' : fnMatch[0]
    expect(fnBody).toContain("mimeType === 'application/pdf'")
    expect(fnBody).toContain("mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'")
    expect(fnBody).not.toContain('msword')
    // 12MB 上限与 managed 侧一致
    expect(service).toContain('12 * 1024 * 1024')
  })

  it('preload wires readPreview with the payload guard', () => {
    const preload = source('../src/preload/index.ts')
    expect(preload).toContain('readPreview: (request: ExternalPathRequest) => invoke(EXTERNAL_LIBRARY_IPC_CHANNELS.readPreview, request, isExternalFilePreview)')
  })
})
