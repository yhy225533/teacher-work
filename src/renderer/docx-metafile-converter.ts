import { convertMetafileToSvg } from 'emf-converter'

import type { MetafileConverter } from './docx-preprocess'

/**
 * V1.17.1（D102）：WMF/EMF/EMF+ → SVG 转换器实现，使用 `emf-converter` 的浏览器入口。
 * 该库通过异步 API 支持普通 GDI 与 GDI+ 记录，且不依赖 Node API 或原生模块。
 *
 * `MetafileConverter` 保持注入式端口，编排层会等待此 Promise；转换失败统一返回 null，
 * 由上层保留原始部件与既有「用系统应用打开」逃生门。
 */

/** 限制输出坐标空间，避免异常 metafile 申请过大画布；纵横比由库自动保持。 */
const MAX_WIDTH = 1600
const MAX_HEIGHT = 1200

export const convertMetafile: MetafileConverter = async (bytes): Promise<string | null> => {
  try {
    // 切片保证不携带原 buffer 的偏移，避免把整个 docx 留在转换器闭包中。
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const svg = await convertMetafileToSvg(buffer, {
      maxWidth: MAX_WIDTH,
      maxHeight: MAX_HEIGHT,
      includeSize: true,
    })
    if (!svg) return null
    // D100：无 namespace 的 SVG 会被浏览器静默渲染为空白，故保留显式补齐。
    const normalized = /\sxmlns\s*=/.test(svg)
      ? svg
      : svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"')
    return normalized.length > 0 ? normalized : null
  } catch {
    // 库对损坏或不受支持的记录流抛错时，降级为"不转换"。
    return null
  }
}
