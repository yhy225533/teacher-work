import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'

import { convertMetafile } from './docx-metafile-converter'
import { preprocessDocx } from './docx-preprocess'
import { dataUrlToUint8Array } from './pdf-binary'

/**
 * V1.11（D67）：Word(.docx) 应用内只读预览；V1.12（D72）：内嵌图片 data: URL 化；
 * V1.17（D94/D95）：渲染前预处理——WMF/EMF 矢量部件转 SVG + OLE 公式 `w:object` 改写为 `w:drawing`。
 * - 载荷 = readContent 的 binary dataUrl（内容经 IPC 由 Main 读取，Renderer 不接触路径）；
 * - docx-preview 的 renderAsync 一次性渲染到受控容器（DOM 构建型，无脚本执行路径）；
 * - useBase64URL: true —— 内嵌图片走 data: URL（CSP img-src 已允许 data:）；
 *   默认的 blob: URL 会被 CSP 静默拦截（图片空白），且 data URL 随 DOM 释放，无 revoke 语义；
 * - 预处理纯内存（不写盘、不改原文件、不入 files 表）；**转换失败即回落原始字节**，
 *   因此预处理异常永远不会让预览比修复前更差；
 * - 卸载清空容器；失败态由调用方渲染系统打开逃生门；
 * - 纯只读：内嵌图片仅在内存解码，不写文件、不落盘。
 */
export default function DocxPreview({ dataUrl }: { readonly dataUrl: string }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [renderError, setRenderError] = useState('')

  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    let cancelled = false
    container.textContent = ''

    void (async () => {
      try {
        const source = dataUrlToUint8Array(dataUrl)
        // preprocessDocx 自身保证失败即返回原始字节，无需在此再做 try/catch 兜底。
        const prepared = await preprocessDocx(source.buffer as ArrayBuffer, convertMetafile)
        if (cancelled) return
        await renderAsync(prepared.bytes, container, undefined, { inWrapper: true, useBase64URL: true })
        if (!cancelled) setRenderError('')
      } catch (error: unknown) {
        if (!cancelled) setRenderError(error instanceof Error ? error.message : '文档解析失败。')
      }
    })()

    return () => {
      cancelled = true
      container.textContent = ''
    }
  }, [dataUrl])

  if (renderError !== '') {
    return <div className="docx-preview-state inline-error" role="alert"><p>Word 文档打开失败：{renderError}</p></div>
  }

  return <div className="docx-preview" aria-label="Word 文档预览" ref={containerRef} />
}
