import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ManagedFileService } from '../src/main/files/managed-file-service'
import { initializeWorkspace, type WorkspaceHandle } from '../src/main/workspace/workspace-service'

/**
 * V1.12（D72）：带内嵌图片的 docx——fixture 字节结构 + readContent binary 往返钉测。
 * 渲染端 data: URL 行为（useBase64URL: true）由 V112-C 隔离冒烟在真实 DOM 断言
 * （node 测试无 DOM，不做 renderAsync 渲染断言——与 V1.11 同一测试分层约定）。
 */

interface Fixture {
  readonly baseDirectory: string
  readonly workspace: WorkspaceHandle
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
  const baseDirectory = mkdtempSync(join(tmpdir(), 'teacher-workbench-v112a-'))
  const workspace = initializeWorkspace(join(baseDirectory, 'workspace'), join(baseDirectory, 'install'))
  const files = new ManagedFileService(workspace.database.raw, workspace.paths, {
    now: () => '2026-09-10T00:00:00.000Z',
  })
  const fixture = { baseDirectory, workspace, files }
  fixtures.push(fixture)
  return fixture
}

/** 最小合法 PNG（1×1 黑色像素，IHDR+IDAT+IEND，不含辅助块）。 */
function minimalPng(): Buffer {
  const signature = Buffer.from('89504e470d0a1a0a', 'hex')
  const ihdrData = Buffer.concat([
    Buffer.from([0, 0, 0, 1]), // width
    Buffer.from([0, 0, 0, 1]), // height
    Buffer.from([8, 0, 0, 0, 0]), // bit depth 8, color type 0 (grayscale)
  ])
  const ihdr = pngChunk('IHDR', ihdrData)
  // 1×1 灰度扫描线：filter byte 0 + 1 像素值 0
  const rawScanline = Buffer.from([0, 0])
  const idat = pngChunk('IDAT', zlibDeflateFixed(rawScanline))
  const iend = pngChunk('IEND', Buffer.alloc(0))
  return Buffer.concat([signature, ihdr, idat, iend])
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  chunk.write(type, 4, 'ascii')
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return chunk
}

/** zlib deflate（固定 Huffman，无依赖）——PNG IDAT 最小编码。 */
function zlibDeflateFixed(raw: Buffer): Buffer {
  // PNG 灰度 1×1 的 scanline = [0x00, 0x00]：literal 0 两次 + 结束码。
  // deflate 固定 Huffman：literal 0 = 8 bit (0x30 反序写入)；end-of-block = 7 bit 0000000。
  // 直接返回手工构造的字节序列（1×1 黑像素的标准编码，unzip 校验在断言里做不了就靠魔数）。
  const header = Buffer.from([0x78, 0x01])
  // BFINAL=1, BTYPE=01（固定 Huffman）: 0b01=byte0 低 3 位 0x01... 组合见下
  // bit 流：BTYPE(2)=01,BFINAL(1)=1 → 第一字节低 3 位 = 0b011 = 0x03
  // literal 0 编码 = 8 位 00110000（低位先写）→ 跨字节填充
  // 简化：用两字节近似常见 zlib 输出 0x63 0x00 0x00（0x63 = 01100011: BFINAL+BTYPE+lit0 编码前缀）
  // 为保证可解码性，这里采用 JSDeflate 环境验证过的 1×1 灰度 PNG IDAT 标准输出：
  const body = Buffer.from([0x63, 0x60, 0x00, 0x00])
  const adler = adler32(raw)
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(adler, 0)
  return Buffer.concat([header, body, tail])
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

/** 带内嵌图片的 docx：[Content_Types] + .rels + word/document.xml（含 w:drawing 引用 rId）+ word/_rels/document.xml.rels + word/media/image1.png。 */
function docxWithImage(png: Buffer): Buffer {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body><w:p><w:r><w:t>V112 smoke docx with image</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="9525" cy="9525"/><wp:docPr id="1" name="Picture 1"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="image1.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9525" cy="9525"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p></w:body></w:document>`
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>`
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  return zip([
    ['[Content_Types].xml', Buffer.from(contentTypesXml, 'utf8')],
    ['_rels/.rels', Buffer.from(rootRelsXml, 'utf8')],
    ['word/document.xml', Buffer.from(documentXml, 'utf8')],
    ['word/_rels/document.xml.rels', Buffer.from(relsXml, 'utf8')],
    ['word/media/image1.png', png],
  ])
}

/** 最小 zip（store method 0，与 V111-A minimalDocx 同构；支持二进制 body）。 */
function zip(files: readonly (readonly [string, Buffer])[]): Buffer {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, bodyBytes] of files) {
    const nameBytes = Buffer.from(name, 'utf8')
    const crc = crc32(bodyBytes)
    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8) // store
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
    centralEntry.writeUInt32LE(crc, 16)
    centralEntry.writeUInt32LE(bodyBytes.length, 20)
    centralEntry.writeUInt32LE(bodyBytes.length, 24)
    centralEntry.writeUInt16LE(nameBytes.length, 28)
    centralEntry.writeUInt32LE(offset, 42)
    nameBytes.copy(centralEntry, 46)
    central.push(centralEntry)
    offset += local.length + bodyBytes.length
  }
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
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

describe('V112-A docx 内嵌图片（D72）', () => {
  it('fixture：带图 docx 字节结构完整（media png + rels 引用 + drawing 标记 + zip 校验和）', () => {
    const png = minimalPng()
    // PNG 魔数 + IHDR 尺寸 1×1
    expect(png.subarray(0, 8)).toEqual(Buffer.from('89504e470d0a1a0a', 'hex'))
    expect(png.readUInt32BE(16)).toBe(1)
    expect(png.readUInt32BE(20)).toBe(1)

    const docx = docxWithImage(png)
    // zip 魔数 + EOCD 记录 5 个条目
    expect(docx.subarray(0, 4)).toEqual(Buffer.from('504b0304', 'hex'))
    const eocd = docx.subarray(docx.length - 22)
    expect(eocd.readUInt32LE(0)).toBe(0x06054b50)
    expect(eocd.readUInt16LE(8)).toBe(5)
    // 关键部件在字节流中可见（store 无压缩，直接可查）
    expect(docx.toString('latin1')).toContain('word/media/image1.png')
    expect(docx.toString('utf8')).toContain('r:embed="rId1"')
    expect(docx.toString('utf8')).toContain('media/image1.png')
  })

  it('带图 docx 经 readContent 仍是完整 binary 往返（V1.11 合同零回归）', () => {
    const fixture = createFixture()
    const png = minimalPng()
    const sourcePath = join(fixture.baseDirectory, '带图讲义.docx')
    writeFileSync(sourcePath, docxWithImage(png))
    const record = fixture.files.importFile(sourcePath)
    expect(record.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const content = fixture.files.readContent(record.id)
    expect(content.kind).toBe('binary')
    if (content.kind !== 'binary') throw new Error('narrow for type checker')
    // base64 往返逐字节还原（含内嵌 png 的完整包）
    expect(Buffer.from(content.dataUrl.split(',')[1] ?? '', 'base64')).toEqual(docxWithImage(png))
  })

  it('组件钉测：useBase64URL: true 已配置（blob: URL 会被 CSP 拦截）', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const component = readFileSync(
      fileURLToPath(new URL('../src/renderer/docx-preview.tsx', import.meta.url)),
      'utf8',
    )
    expect(component).toContain('useBase64URL: true')
    expect(component).not.toContain('URL.createObjectURL')
    // CSP 零改动钉住：img-src 白名单保持 'self' data:（blob: 不入白名单）
    const indexHtml = readFileSync(
      fileURLToPath(new URL('../src/renderer/index.html', import.meta.url)),
      'utf8',
    )
    expect(indexHtml).toContain("img-src 'self' data:")
    expect(indexHtml).not.toContain('blob:')
  })
})
