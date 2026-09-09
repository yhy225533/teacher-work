import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

import { dataUrlToUint8Array } from './pdf-binary'

/**
 * V1.11（D66）：PDF 应用内只读预览。
 * - 载荷 = readContent 的 binary dataUrl（内容经 IPC 由 Main 读取，Renderer 不接触路径）；
 * - pdfjs worker 经 Vite 资产管道（与使用方同模块，react-pdf 官方推荐路径）；
 * - 连续滚动分页，宽度自适应阅读器栏宽（ResizeObserver）；
 * - 纯只读：无文本层/无注解层（无链接跳转面），失败态由调用方渲染系统打开逃生门；
 * - node 环境源码钉测经 tests/setup-node-dom-stubs.ts 提供 DOMMatrix 模块级占位（仅测试基建）。
 */

// worker 必须与使用方同模块配置（react-pdf 约束：pdfjs.GlobalWorkerOptions.workerSrc）。
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export { dataUrlToUint8Array }

export default function PdfPreview({ dataUrl }: { readonly dataUrl: string }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [pageCount, setPageCount] = useState<number | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (element === null) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setContainerWidth((current) => Math.abs(current - width) < 1 ? current : width)
    })
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [])

  useEffect(() => { setPageCount(null) }, [dataUrl])

  const width = containerWidth > 0 ? containerWidth : 600

  return (
    <div className="pdf-preview" aria-label="PDF 预览" ref={containerRef}>
      <Document
        file={{ data: dataUrlToUint8Array(dataUrl) }}
        onLoadSuccess={(payload) => { setPageCount(payload.numPages) }}
        loading={<div className="pdf-preview-state">正在打开 PDF…</div>}
        error={<div className="pdf-preview-state">PDF 打开失败。</div>}
      >
        {pageCount !== null && Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
          <Page
            key={pageNumber}
            pageNumber={pageNumber}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={<div className="pdf-preview-state">正在渲染第 {pageNumber} 页…</div>}
          />
        ))}
      </Document>
    </div>
  )
}
