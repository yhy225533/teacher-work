import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { CoreDataService } from '../src/main/data/core-data-service'
import { ManagedFileService } from '../src/main/files/managed-file-service'
import { initializeWorkspace, type WorkspaceHandle } from '../src/main/workspace/workspace-service'
import { isManagedFileContent } from '../src/shared/file-contracts'

interface Fixture {
  readonly baseDirectory: string
  readonly workspace: WorkspaceHandle
  readonly core: CoreDataService
  readonly files: ManagedFileService
}

const fixtures: Fixture[] = []

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    fixture.workspace.close()
    rmSync(fixture.baseDirectory, { recursive: true, force: true })
  }
})

function createFixture(): Fixture {
  const baseDirectory = mkdtempSync(join(tmpdir(), 'teacher-workbench-v111a-'))
  const workspace = initializeWorkspace(join(baseDirectory, 'workspace'), join(baseDirectory, 'install'))
  const core = new CoreDataService(workspace.database.raw)
  const files = new ManagedFileService(workspace.database.raw, workspace.paths, {
    now: () => '2026-09-10T00:00:00.000Z',
  })
  const fixture = { baseDirectory, workspace, core, files }
  fixtures.push(fixture)
  return fixture
}

/** 最小合法 PDF 字节流（不参与渲染，仅验证二进制载荷往返）。 */
const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF', 'utf8')

/** 最小合法 docx = 含 [Content_Types].xml 的 zip 包。 */
function minimalDocx(): Buffer {
  const files: readonly (readonly [string, string])[] = [
    ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
    ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'],
  ]
  // 本地 zip 写入（无依赖）：crc32 + 最小 zip 结构
  const encoder = new TextEncoder()
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  const date = 0
  const time = 0
  for (const [name, body] of files) {
    const nameBytes = Buffer.from(encoder.encode(name))
    const bodyBytes = Buffer.from(encoder.encode(body))
    const crc = crc32(bodyBytes)
    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(bodyBytes.length, 18)
    local.writeUInt32LE(bodyBytes.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    local.writeUInt16LE(0, 28)
    nameBytes.copy(local, 30)
    chunks.push(local, bodyBytes)
    const centralEntry = Buffer.alloc(46 + nameBytes.length)
    centralEntry.writeUInt32LE(0x02014b50, 0)
    centralEntry.writeUInt16LE(20, 4)
    centralEntry.writeUInt16LE(20, 6)
    centralEntry.writeUInt16LE(0, 8)
    centralEntry.writeUInt16LE(0, 10)
    centralEntry.writeUInt16LE(time, 12)
    centralEntry.writeUInt16LE(date, 14)
    centralEntry.writeUInt32LE(crc, 16)
    centralEntry.writeUInt32LE(bodyBytes.length, 20)
    centralEntry.writeUInt32LE(bodyBytes.length, 24)
    centralEntry.writeUInt16LE(nameBytes.length, 28)
    centralEntry.writeUInt16LE(0, 30)
    centralEntry.writeUInt16LE(0, 32)
    centralEntry.writeUInt16LE(0, 34)
    centralEntry.writeUInt16LE(0, 36)
    centralEntry.writeUInt32LE(0, 38)
    centralEntry.writeUInt32LE(offset, 42)
    nameBytes.copy(centralEntry, 46)
    central.push(centralEntry)
    offset += local.length + bodyBytes.length
  }
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...chunks, centralBuffer, end])
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

const CRC_TABLE: readonly number[] = (() => {
  const table = new Array<number>(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function importFile(fixture: Fixture, name: string, contents: Buffer): ReturnType<Fixture['files']['importFile']> {
  const sourcePath = join(fixture.baseDirectory, name)
  writeFileSync(sourcePath, contents)
  return fixture.files.importFile(sourcePath)
}

describe('V111-A readContent binary contract (D68)', () => {
  it('returns a binary dataUrl payload for a pdf within the preview limit', () => {
    const fixture = createFixture()
    const record = importFile(fixture, '有理数练习.pdf', MINIMAL_PDF)
    expect(record.mimeType).toBe('application/pdf')
    const content = fixture.files.readContent(record.id)
    expect(content.kind).toBe('binary')
    if (content.kind !== 'binary') throw new Error('narrow for type checker')
    expect(content.dataUrl.startsWith('data:application/pdf;base64,')).toBe(true)
    expect(Buffer.from(content.dataUrl.split(',')[1] ?? '', 'base64')).toEqual(MINIMAL_PDF)
    expect(isManagedFileContent(content)).toBe(true)
  })

  it('returns a binary dataUrl payload for a docx within the preview limit', () => {
    const fixture = createFixture()
    const record = importFile(fixture, '第12讲讲义.docx', minimalDocx())
    expect(record.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const content = fixture.files.readContent(record.id)
    expect(content.kind).toBe('binary')
    if (content.kind !== 'binary') throw new Error('narrow for type checker')
    expect(content.dataUrl.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,')).toBe(true)
    expect(isManagedFileContent(content)).toBe(true)
  })

  it('keeps .doc/.pptx/.xlsx and other binaries on the unsupported path', () => {
    const fixture = createFixture()
    const legacy = importFile(fixture, '旧试卷.doc', Buffer.from('legacy-msword-binary'))
    const legacyContent = fixture.files.readContent(legacy.id)
    expect(legacyContent.kind).toBe('unsupported')

    const pptx = importFile(fixture, '课件.pptx', Buffer.from('fake-pptx-bytes'))
    expect(fixture.files.readContent(pptx.id).kind).toBe('unsupported')

    const octet = importFile(fixture, '素材.bin', Buffer.from('raw-bytes'))
    expect(fixture.files.readContent(octet.id).kind).toBe('unsupported')
  })

  it('keeps image/text/oversize paths byte-identical (zero regression on frozen branches)', () => {
    const fixture = createFixture()
    const pngSource = join(fixture.baseDirectory, '题图.png')
    writeFileSync(pngSource, Buffer.from('89504e470d0a1a0a', 'hex'))
    const image = fixture.files.importFile(pngSource)
    const imageContent = fixture.files.readContent(image.id)
    expect(imageContent.kind).toBe('image')
    if (imageContent.kind !== 'image') throw new Error('narrow for type checker')
    expect(imageContent.dataUrl.startsWith('data:image/png;base64,')).toBe(true)

    const text = importFile(fixture, '笔记.txt', Buffer.from('纯文本', 'utf8'))
    expect(fixture.files.readContent(text.id)).toMatchObject({ kind: 'text', content: '纯文本' })

    // 超限 pdf 仍走 unsupported（12MB 上限对 binary 同样生效）
    const large = Buffer.alloc(12 * 1024 * 1024 + 1, 0)
    large.write('%PDF-1.4', 0, 'utf8')
    const largeRecord = importFile(fixture, '大文件.pdf', large)
    const largeContent = fixture.files.readContent(largeRecord.id)
    expect(largeContent.kind).toBe('unsupported')
    if (largeContent.kind !== 'unsupported') throw new Error('narrow for type checker')
    expect(largeContent.message).toContain('文件较大')
  })

  it('guard rejects a forged binary payload without a data: prefix', () => {
    expect(isManagedFileContent({ file: { id: 'f', originalName: 'a.pdf', sizeBytes: 1, mimeType: 'application/pdf', originFileId: null, mtimeMs: null, contentHash: null, createdAt: 't', updatedAt: 't', deletedAt: null }, kind: 'binary', dataUrl: 'http://evil' })).toBe(false)
    expect(isManagedFileContent({ file: { id: 'f', originalName: 'a.pdf', sizeBytes: 1, mimeType: 'application/pdf', originFileId: null, mtimeMs: null, contentHash: null, createdAt: 't', updatedAt: 't', deletedAt: null }, kind: 'binary', dataUrl: '' })).toBe(false)
    expect(isManagedFileContent({ file: { id: 'f', originalName: 'a.pdf', sizeBytes: 1, mimeType: 'application/pdf', originFileId: null, mtimeMs: null, contentHash: null, createdAt: 't', updatedAt: 't', deletedAt: null }, kind: 'binary', dataUrl: 'data:application/pdf;base64,JVBERg==' })).toBe(true)
  })
})
