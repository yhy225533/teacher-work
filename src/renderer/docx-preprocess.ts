import JSZip from 'jszip'

/**
 * V1.17（D94/D95）：docx 预处理——把 WMF/EMF 矢量部件转换为 SVG，并把 OLE 公式容器 `w:object`
 * 改写为可渲染的 `w:drawing`，使 docx-preview 能显示 MathType 公式与矢量图片。
 *
 * 背景（实测，见 `docs/v1.17-docx-metafile-plan.md` §2）：老师的 docx 公式多为 MathType OLE 公式
 * （`ProgId="Equation.DSMT4"`），可视形态是 WMF/EMF；docx-preview 的 parseRun **没有 `object` 分支**
 * （整块静默丢弃），且 Chromium 无法解码 WMF/EMF（图片零尺寸空白）。两者必须同时处理。
 *
 * 设计约束：
 * - **纯内存**：只操作传入的字节，不写盘、不读路径、不碰数据库；
 * - **转换器可注入**：本模块不 import 任何依赖 DOM 的渲染库，便于在 Node 环境下单测编排逻辑；
 * - **失败即不变**：任何异常或零转换都返回**原始字节**，绝不产出比现状更差的文档（D94 红线）；
 * - 不依赖 React，不依赖 Node 内建模块（Renderer 边界）。
 */

export type MetafileKind = 'wmf' | 'emf'

/**
 * 转换器端口：输入 metafile 字节，返回 SVG 字符串或异步结果；无法转换时返回 null。
 * 返回的 SVG 若缺少 `xmlns`，编排层会补齐（D95：缺 xmlns 会被浏览器静默渲染为空白）。
 */
export type MetafileConverter = (
  bytes: Uint8Array,
  kind: MetafileKind,
) => string | null | Promise<string | null>

export interface DocxPreprocessResult {
  /** 可直接交给 docx-preview `renderAsync` 的字节（发生任何异常时为原始字节）。 */
  readonly bytes: ArrayBuffer
  /** 成功转换的 metafile 部件数（0 表示未做任何改写，bytes 即原始字节）。 */
  readonly converted: number
  /** 参与扫描的 metafile 部件数。 */
  readonly scanned: number
  /** 改写为 w:drawing 的 OLE 公式对象数。 */
  readonly rewrittenObjects: number
  /** 转换失败但仍保留原样的部件数（渲染为空白，与现状一致）。 */
  readonly failed: number
}

/** metafile 扩展名 → 类型；非 metafile 返回 null。 */
function metafileKindOf(path: string): MetafileKind | null {
  const lower = path.toLowerCase()
  if (lower.endsWith('.wmf')) return 'wmf'
  if (lower.endsWith('.emf')) return 'emf'
  return null
}

/**
 * D95：WMFJS/EMFJS 产出的 SVG 根节点不含 `xmlns`，直接内嵌会被浏览器静默渲染为空白且不报错。
 * 实测缺失时 180/193 张空白、补齐后 193/193 可见——此处强制补齐，禁止移除。
 */
function ensureSvgNamespace(svg: string): string {
  if (/\sxmlns\s*=/.test(svg)) return svg
  return svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"')
}

/**
 * 只接受**确实画了东西**的 SVG：空 SVG（如转换器解析失败后返回的空壳）会让该位置保持空白，
 * 不如保留原部件走既有逃生门。图元计数口径与实测脚本一致。
 */
function hasDrawableContent(svg: string): boolean {
  return /<(?:path|rect|line|polyline|polygon|circle|ellipse|text|image|g|use)\b/.test(svg)
}

/** 从 `style="height:18pt;width:29.25pt"` 取 pt 尺寸；缺失或非法返回 null。 */
export function parseExtentPt(style: string): { widthPt: number; heightPt: number } | null {
  const width = /(?:^|;)\s*width\s*:\s*([0-9.]+)\s*pt\b/i.exec(style)
  const height = /(?:^|;)\s*height\s*:\s*([0-9.]+)\s*pt\b/i.exec(style)
  if (width === null || height === null) return null
  const widthPt = Number.parseFloat(width[1])
  const heightPt = Number.parseFloat(height[1])
  if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt <= 0 || heightPt <= 0) return null
  return { widthPt, heightPt }
}

/** 1pt = 12700 EMU（OOXML 英制度量单位）。 */
const EMU_PER_PT = 12700

/**
 * `w:object`（OLE 容器）→ `w:drawing`（可渲染的内联图片）。
 * 仅当容器内的 `v:imagedata` 指向**已成功转换**的部件、且能解析出 pt 尺寸时改写；
 * 其余 `w:object` **原样保留**（不破坏源文档语义）。
 */
function rewriteObjectElements(
  xml: string,
  convertedRelIds: ReadonlySet<string>,
  nextDocPrId: () => number,
): { xml: string; rewritten: number } {
  let rewritten = 0
  const out = xml.replace(/<w:object>[\s\S]*?<\/w:object>/g, (whole) => {
    const relId = /<v:imagedata[^>]*\sr:id="([^"]+)"/.exec(whole)?.[1]
    const style = /style="([^"]*)"/.exec(whole)?.[1]
    if (relId === undefined || style === undefined) return whole
    if (!convertedRelIds.has(relId)) return whole
    const extent = parseExtentPt(style)
    if (extent === null) return whole

    const cx = Math.round(extent.widthPt * EMU_PER_PT)
    const cy = Math.round(extent.heightPt * EMU_PER_PT)
    const id = nextDocPrId()
    rewritten += 1
    // `xmlns:a` / `xmlns:pic` 在本项目真实样本的根元素上**未声明**（只声明了 w/wp/v/o/r/m），
    // 故与 Word 自身写出 `w:drawing` 的做法一致，在此就地声明。
    return (
      '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
      `<wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:docPr id="${id}" name="Equation ${id}"/>` +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:nvPicPr><pic:cNvPr id="0" name="Equation"/><pic:cNvPicPr/></pic:nvPicPr>' +
      `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>'
    )
  })
  return { xml: out, rewritten }
}

/** 把 `[Content_Types].xml` 中的 wmf/emf 扩展名条目换成 svg（并确保 svg 条目存在）。 */
function rewriteContentTypes(xml: string): string {
  let out = xml
    .replace(/<Default\s[^>]*Extension="wmf"[^>]*\/>/gi, '')
    .replace(/<Default\s[^>]*Extension="emf"[^>]*\/>/gi, '')
    .replace(/<Override\s[^>]*PartName="[^"]*\.(?:wmf|emf)"[^>]*\/>/gi, '')
  if (!/Extension="svg"/i.test(out)) {
    out = out.replace(/<Types\b[^>]*>/, (open) => `${open}<Default Extension="svg" ContentType="image/svg+xml"/>`)
  }
  return out
}

/** 把 relationships 中指向已转换部件的 Target 改为 .svg。 */
function rewriteRels(xml: string, renamed: ReadonlyMap<string, string>): string {
  let out = xml
  for (const [from, to] of renamed) {
    out = out.split(`Target="${from}"`).join(`Target="${to}"`)
  }
  return out
}

/**
 * 预处理 docx 字节。返回结果中的 `bytes` 永远可直接渲染：
 * 未发生有效改写时它就是输入原本的字节。
 */
export async function preprocessDocx(
  input: ArrayBuffer,
  convert: MetafileConverter,
): Promise<DocxPreprocessResult> {
  const original: DocxPreprocessResult = {
    bytes: input,
    converted: 0,
    scanned: 0,
    rewrittenObjects: 0,
    failed: 0,
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(input)
  } catch {
    return original
  }

  try {
    const metafilePaths = Object.keys(zip.files).filter(
      (path) => !zip.files[path].dir && metafileKindOf(path) !== null,
    )
    if (metafilePaths.length === 0) return { ...original, scanned: 0 }

    // 1) 逐部件转换；失败的保持原样（与现状一致，不劣化）。
    const renamed = new Map<string, string>()
    let failed = 0
    for (const path of metafilePaths) {
      const kind = metafileKindOf(path)
      if (kind === null) continue
      let svg: string | null = null
      try {
        svg = await convert(await zip.files[path].async('uint8array'), kind)
      } catch {
        svg = null
      }
      if (svg === null) {
        failed += 1
        continue
      }
      const normalized = ensureSvgNamespace(svg)
      if (!hasDrawableContent(normalized)) {
        failed += 1
        continue
      }
      const target = path.replace(/\.(?:wmf|emf)$/i, '.svg')
      zip.file(target, normalized)
      zip.remove(path)
      // rels 里的 Target 是相对 word/ 的路径（如 media/image1.wmf）。
      renamed.set(path.replace(/^word\//, ''), target.replace(/^word\//, ''))
    }

    if (renamed.size === 0) {
      // 零成功：不做任何改写，直接返回原始字节（D94 红线）。
      return { ...original, scanned: metafilePaths.length, failed }
    }

    // 2) 同步 relationships 与 Content_Types，并记录已转换部件的 rId。
    // 注意：改写后 Target 已是新路径（.svg），故按**新路径集合**反查，而非 renamed 的键（旧路径）。
    const convertedTargets = new Set(renamed.values())
    const convertedRelIds = new Set<string>()
    for (const path of Object.keys(zip.files)) {
      if (!path.endsWith('.rels')) continue
      const relsXml = await zip.files[path].async('string')
      const updated = rewriteRels(relsXml, renamed)
      if (updated === relsXml) continue
      zip.file(path, updated)
      for (const rel of updated.matchAll(/<Relationship\b[^>]*>/g)) {
        const id = /Id="([^"]+)"/.exec(rel[0])?.[1]
        const target = /Target="([^"]+)"/.exec(rel[0])?.[1]
        if (id !== undefined && target !== undefined && convertedTargets.has(target)) convertedRelIds.add(id)
      }
    }
    const contentTypes = zip.file('[Content_Types].xml')
    if (contentTypes !== null) {
      zip.file('[Content_Types].xml', rewriteContentTypes(await contentTypes.async('string')))
    }

    // 3) 把指向已转换部件的 OLE 容器改写为 w:drawing（仅这些，其余 w:object 原样保留）。
    let docPrId = 900000
    let rewrittenObjects = 0
    for (const path of Object.keys(zip.files)) {
      if (!/^word\/.*\.xml$/i.test(path)) continue
      const xml = await zip.files[path].async('string')
      if (!xml.includes('<w:object>')) continue
      const result = rewriteObjectElements(xml, convertedRelIds, () => (docPrId += 1))
      if (result.rewritten === 0) continue
      zip.file(path, result.xml)
      rewrittenObjects += result.rewritten
    }

    const bytes = await zip.generateAsync({ type: 'arraybuffer' })
    return {
      bytes,
      converted: renamed.size,
      scanned: metafilePaths.length,
      rewrittenObjects,
      failed,
    }
  } catch {
    // 编排层任何异常都回落原始字节（D94 红线）。
    return original
  }
}
