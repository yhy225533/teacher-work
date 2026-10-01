import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import {
  parseExtentPt,
  preprocessDocx,
  type MetafileConverter,
} from '../src/renderer/docx-preprocess'

/**
 * V1.17（D94/D95/D96）：docx 预处理编排逻辑钉测。
 *
 * 测试分层与 V1.11/V1.12 一致：node 环境无 DOM，不在此做真实渲染断言；
 * 真实 WMF/EMF 转换与渲染结果由隔离 Windows 冒烟（真实 Electron + 真实 CSP）验证。
 * 因此这里**注入 fake 转换器**，只钉编排契约：部件替换、rels/Content_Types 同步、
 * `w:object` → `w:drawing` 改写、xmlns 补齐、以及"失败即不变"红线。
 */

const DRAWABLE_SVG = '<svg width="10" height="10"><path d="M0 0L1 1"/></svg>'
const EMPTY_SVG = '<svg width="10" height="10"></svg>'

/** 构造最小 docx：1 个 wmf 部件 + 可选 emf 部件 + 指向指定目标的 w:object。 */
async function buildDocx(options: {
  readonly includeWmf?: boolean
  readonly includeEmf?: boolean
  readonly objectStyle?: string
  readonly objectRelId?: string
  /** w:object 内 v:imagedata 指向的部件路径；默认指向会被转换的 image1.wmf。 */
  readonly objectTarget?: string
} = {}): Promise<ArrayBuffer> {
  const includeWmf = options.includeWmf ?? true
  const includeEmf = options.includeEmf ?? false
  const objectRelId = options.objectRelId ?? 'rId7'
  const objectTarget = options.objectTarget ?? 'media/image1.wmf'
  const objectStyle = options.objectStyle ?? 'height:18pt;width:29.25pt;'

  const zip = new JSZip()
  const rels: string[] = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.wmf"/>',
  ]
  if (includeEmf) {
    rels.push(
      '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.emf"/>',
    )
  }
  rels.push(
    `<Relationship Id="${objectRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${objectTarget}"/>`,
  )

  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      (includeWmf ? '<Default Extension="wmf" ContentType="image/x-wmf"/>' : '') +
      (includeEmf ? '<Default Extension="emf" ContentType="image/x-emf"/>' : '') +
      '</Types>',
  )
  zip.file(
    'word/document.xml',
    '<?xml version="1.0"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
      'xmlns:v="urn:schemas-microsoft-com:vml">' +
      '<w:body><w:p><w:r>' +
      `<w:object><v:shape style="${objectStyle}"><v:imagedata r:id="${objectRelId}"/></v:shape></w:object>` +
      '</w:r></w:p></w:body></w:document>',
  )
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0"?><Relationships>${rels.join('')}</Relationships>`)
  if (includeWmf) zip.file('word/media/image1.wmf', new Uint8Array([1, 2, 3, 4]))
  if (includeEmf) zip.file('word/media/image2.emf', new Uint8Array([5, 6, 7, 8]))

  return zip.generateAsync({ type: 'arraybuffer' })
}

const okConverter: MetafileConverter = () => DRAWABLE_SVG
const failConverter: MetafileConverter = () => null
const emptyConverter: MetafileConverter = () => EMPTY_SVG
const throwConverter: MetafileConverter = () => {
  throw new Error('boom')
}

async function readPart(bytes: ArrayBuffer, path: string): Promise<string | null> {
  const zip = await JSZip.loadAsync(bytes)
  const entry = zip.file(path)
  return entry === null ? null : entry.async('string')
}

describe('V1.17 docx 预处理（D94 编排契约）', () => {
  it('把 wmf 部件换为 svg，并删除原部件', async () => {
    const result = await preprocessDocx(await buildDocx(), okConverter)
    expect(result.converted).toBe(1)
    expect(result.scanned).toBe(1)
    expect(await readPart(result.bytes, 'word/media/image1.svg')).not.toBeNull()
    expect(await readPart(result.bytes, 'word/media/image1.wmf')).toBeNull()
  })

  it('同步改写 rels 的 Target 与 [Content_Types].xml', async () => {
    const result = await preprocessDocx(await buildDocx(), okConverter)
    const rels = await readPart(result.bytes, 'word/_rels/document.xml.rels')
    expect(rels).toContain('Target="media/image1.svg"')
    expect(rels).not.toContain('image1.wmf')

    const contentTypes = await readPart(result.bytes, '[Content_Types].xml')
    expect(contentTypes).toContain('Extension="svg"')
    expect(contentTypes).toContain('image/svg+xml')
    expect(contentTypes).not.toContain('Extension="wmf"')
  })

  it('D95：生成的 SVG 必须带 xmlns（缺失会被浏览器静默渲染为空白）', async () => {
    const result = await preprocessDocx(await buildDocx(), okConverter)
    const svg = await readPart(result.bytes, 'word/media/image1.svg')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('D95：转换器已带 xmlns 时不重复注入', async () => {
    const withNs: MetafileConverter = () => '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'
    const result = await preprocessDocx(await buildDocx(), withNs)
    const svg = await readPart(result.bytes, 'word/media/image1.svg')
    expect(svg?.match(/xmlns=/g)?.length).toBe(1)
  })

  it('把指向已转换部件的 w:object 改写为 w:drawing，并保留 pt 尺寸（1pt=12700 EMU）', async () => {
    const result = await preprocessDocx(await buildDocx(), okConverter)
    expect(result.rewrittenObjects).toBe(1)
    const xml = await readPart(result.bytes, 'word/document.xml')
    expect(xml).toContain('<w:drawing>')
    expect(xml).not.toContain('<w:object>')
    expect(xml).toContain('cx="371475"') // 29.25pt
    expect(xml).toContain('cy="228600"') // 18pt
    expect(xml).toContain('<a:blip r:embed="rId7"/>')
    // 根元素未声明 xmlns:a / xmlns:pic，故必须就地声明
    expect(xml).toContain('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"')
    expect(xml).toContain('xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"')
  })

  it('w:object 指向未转换部件时保持原样（不破坏源语义）', async () => {
    // 该 w:object 指向一个 png 部件（非 metafile），永不出现在已转换集合中
    const result = await preprocessDocx(
      await buildDocx({ objectTarget: 'media/photo.png', objectRelId: 'rId99' }),
      okConverter,
    )
    const xml = await readPart(result.bytes, 'word/document.xml')
    expect(xml).toContain('<w:object>')
    expect(xml).not.toContain('<w:drawing>')
    expect(result.rewrittenObjects).toBe(0)
    // wmf 部件本身仍被正常转换（两者互不影响）
    expect(result.converted).toBe(1)
  })

  it('style 缺少 pt 尺寸时不改写该 w:object', async () => {
    const result = await preprocessDocx(
      await buildDocx({ objectStyle: 'height:18px;width:29.25px;' }),
      okConverter,
    )
    const xml = await readPart(result.bytes, 'word/document.xml')
    expect(xml).toContain('<w:object>')
    expect(result.rewrittenObjects).toBe(0)
  })
})

describe('V1.17 失败即不变（D94 红线）', () => {
  it('转换器全部返回 null → 返回原始字节', async () => {
    const input = await buildDocx()
    const result = await preprocessDocx(input, failConverter)
    expect(result.converted).toBe(0)
    expect(result.scanned).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.bytes).toBe(input)
  })

  it('转换器抛异常 → 返回原始字节，不向外抛错', async () => {
    const input = await buildDocx()
    const result = await preprocessDocx(input, throwConverter)
    expect(result.converted).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.bytes).toBe(input)
  })

  it('转换结果为无图元空 SVG → 视为失败，保留原部件', async () => {
    const input = await buildDocx()
    const result = await preprocessDocx(input, emptyConverter)
    expect(result.converted).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.bytes).toBe(input)
    const zip = await JSZip.loadAsync(result.bytes)
    expect(zip.file('word/media/image1.wmf')).not.toBeNull()
  })

  it('输入不是有效 zip → 返回原始字节', async () => {
    const input = new Uint8Array([1, 2, 3, 4, 5]).buffer
    const result = await preprocessDocx(input, okConverter)
    expect(result.converted).toBe(0)
    expect(result.bytes).toBe(input)
  })

  it('无 metafile 的 docx → 零改写，返回原始字节', async () => {
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types/>')
    zip.file('word/document.xml', '<w:document/>')
    const input = await zip.generateAsync({ type: 'arraybuffer' })
    const result = await preprocessDocx(input, okConverter)
    expect(result.scanned).toBe(0)
    expect(result.converted).toBe(0)
    expect(result.bytes).toBe(input)
  })
})

describe('V1.17 多部件与失败混合', () => {
  it('部分成功时只改写成功的部件，失败的保持原样', async () => {
    const selective: MetafileConverter = (bytes) => (bytes[0] === 1 ? DRAWABLE_SVG : null)
    const result = await preprocessDocx(await buildDocx({ includeEmf: true }), selective)
    expect(result.scanned).toBe(2)
    expect(result.converted).toBe(1)
    expect(result.failed).toBe(1)
    const zip = await JSZip.loadAsync(result.bytes)
    expect(zip.file('word/media/image1.svg')).not.toBeNull()
    expect(zip.file('word/media/image2.emf')).not.toBeNull() // 失败者原样保留
  })
})

describe('V1.17 parseExtentPt', () => {
  it('解析 pt 尺寸', () => {
    expect(parseExtentPt('height:18pt;width:29.25pt;')).toEqual({ widthPt: 29.25, heightPt: 18 })
  })

  it('容忍属性顺序与空白', () => {
    expect(parseExtentPt('width: 12pt ; height: 7.5pt')).toEqual({ widthPt: 12, heightPt: 7.5 })
  })

  it('非 pt / 缺失 / 非法值返回 null', () => {
    expect(parseExtentPt('height:18px;width:29.25px;')).toBeNull()
    expect(parseExtentPt('height:18pt;')).toBeNull()
    expect(parseExtentPt('height:0pt;width:29.25pt;')).toBeNull()
    expect(parseExtentPt('')).toBeNull()
  })
})
