import { useEffect, useState } from 'react'

import type { ExportPrintPayload } from '../shared/export-contracts'
import { MarkdownDocument } from './lesson-material-reader'
import './print-document.css'

/**
 * V19-E（D48–D54）：隐藏打印窗的打印视图（`?print=1` 专用）。
 * - 挂载即取 `export:get-print-payload` 载荷（Main 组装，不信任 Renderer）；
 * - 复用 MarkdownDocument 所见即所得（KaTeX + 题图 dataUrl 与阅读器一致）；
 * - 就绪协议：fonts.ready + 全部 `<img>` complete（失败占位不阻断）→ `export:print-ready`；
 * - 载荷失败显示最小错误态（Main 60s 超时兜底销毁），无其他 UI。
 */
type PrintPayloadState = ExportPrintPayload

export default function PrintDocumentView(): React.JSX.Element {
  const [payload, setPayload] = useState<PrintPayloadState | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.teacherWorkbench.export.getPrintPayload()
      .then((next) => { if (!cancelled) setPayload(next) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (payload === null) return
    let cancelled = false
    void (async () => {
      try {
        await document.fonts.ready
        await waitForAllImages()
      } catch {
        // 就绪探测失败不阻断：printToPDF 由 Main 60s 超时兜底。
      }
      if (!cancelled) void window.teacherWorkbench.export.printReady().catch(() => undefined)
    })()
    return () => { cancelled = true }
  }, [payload])

  if (failed) {
    return <div className="print-error" role="alert">导出载荷读取失败，本次导出已中止。</div>
  }
  if (payload === null) {
    return <div className="print-loading">正在准备打印内容…</div>
  }
  const { bodyMd, files } = payload
  return (
    <main className="print-document" aria-label="打印预览">
      <MarkdownDocument body={bodyMd} files={files} />
    </main>
  )
}

/** 等待文档内全部图片加载完成（complete 或 error 都算就绪——占位不阻断导出）。 */
async function waitForAllImages(): Promise<void> {
  const images = Array.from(document.querySelectorAll('img'))
  await Promise.all(images.map((image) => image.complete
    ? undefined
    : new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true })
      image.addEventListener('error', () => resolve(), { once: true })
    })))
}
