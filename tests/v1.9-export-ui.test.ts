import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** V19-E：打印视图与课件区入口（结构钉测；Main 通道消费语义在 export-* 三组测试中钉死）。 */
describe('V19-E 导出 UI（打印视图 + 课件区入口）', () => {
  it('?print=1 branch renders PrintDocumentView instead of App; main window path unchanged', () => {
    const main = source('../src/renderer/main.tsx')
    expect(main).toContain("new URLSearchParams(window.location.search).get('print') === '1'")
    expect(main).toContain('{isPrintWindow ? <PrintDocumentView /> : <App />}')
    // 两分支共用 RendererErrorBoundary；主窗零变化（App 与 styles.css 仍在）
    expect(main).toContain('<RendererErrorBoundary>')
    expect(main).toContain("import './styles.css'")
    expect(main).toContain("import App from './App'")
  })

  it('PrintDocumentView: payload -> MarkdownDocument -> ready protocol, minimal error state', () => {
    const view = source('../src/renderer/print-document-view.tsx')
    // 挂载即取载荷（Main 组装）；失败最小错误态，不重试
    expect(view).toContain('window.teacherWorkbench.export.getPrintPayload()')
    expect(view).toContain('导出载荷读取失败，本次导出已中止。')
    expect(view).not.toContain('重试')
    // 复用 MarkdownDocument（所见即所得，渲染语义零改动）
    expect(view).toContain("import { MarkdownDocument } from './lesson-material-reader'")
    expect(view).toContain('<MarkdownDocument body={bodyMd} files={files} />')
    // 就绪协议：fonts.ready + 全部 img complete（load/error 都算就绪——失败占位不阻断）
    expect(view).toContain('document.fonts.ready')
    expect(view).toContain('waitForAllImages')
    expect(view).toContain("image.addEventListener('load'")
    expect(view).toContain("image.addEventListener('error'")
    expect(view).toContain('window.teacherWorkbench.export.printReady()')
    // 就绪探测失败不阻断（Main 60s 超时兜底）
    expect(view).toContain('就绪探测失败不阻断：printToPDF 由 Main 60s 超时兜底')
  })

  it('print-document.css pins the A4 layout rules (§5) without touching main styles.css', () => {
    const css = source('../src/renderer/print-document.css')
    expect(css).toContain('font-size: 11pt')
    // 防断裂：公式/图片/表/代码/引块 + 标题 break-after
    expect(css).toContain('.print-document .material-math-display')
    expect(css).toContain('.print-document .material-markdown-image')
    for (const block of ['table', 'pre', 'blockquote']) {
      expect(css).toContain(`.print-document ${block}`)
    }
    expect(css).toContain('break-inside: avoid')
    expect(css).toContain('break-after: avoid')
    expect(css).toContain('max-width: 100%')
    // 白底黑字（printBackground:false 由 printToPDF 参数控制，CSS 不再叠背景）
    expect(css).toContain('color: #000')
    // 无自动封面（D53）：不存在 .print-cover / print-title-block
    expect(css).not.toContain('print-cover')
    expect(css).not.toContain('print-title-block')
  })

  it('entry button: md-gated, busy state, wired to export.printToPdf with lesson header text', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    // 请求只带 fileId/lessonId/headerText——正文与路径都不经 Renderer（Main 直读）
    expect(section).toContain('window.teacherWorkbench.export.printToPdf({')
    expect(section).toContain('fileId: selectedFile.id')
    expect(section).toContain('lessonId: prepContext.lessonId')
    expect(section).toContain('headerText: exportHeaderText()')
    // 非 md 置灰（与「修改这份」同一判定 isAiEditableFile）
    expect(section).toContain('disabled={busy || exportBusy || !canModifySelectedFile}')
    expect(section).toContain('仅支持导出 Markdown 文件')
    // busy 文案与结果提示分支
    expect(section).toContain("{exportBusy ? '导出中…' : '⬇ 导出 PDF'}")
    expect(section).toContain("result.saved")
    expect(section).toContain('已导出：')
    expect(section).toContain('已取消导出。')
    // 失败走既有 inline-error
    expect(section).toContain('setError(toErrorMessage(exportError')
  })

  it('headerText assembly: one-to-one student name · lesson title; class mode lesson title; capped at 100 chars', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    const block = section.slice(section.indexOf('function exportHeaderText'), section.indexOf('async function exportSelectedPdf'))
    expect(block).toContain("prepContext.courseMode === 'one_to_one' ? prepContext.studentNames[0] : ''")
    expect(block).toContain('`${studentName} · ${prepContext.lessonTitle}`')
    expect(block).toContain('Array.from(text).slice(0, 100)')
  })

  it('readOnly (ended course) keeps the export entry: export + ⋯ only', () => {
    const section = source('../src/renderer/lesson-files-section.tsx')
    const readOnlyBlock = section.slice(section.indexOf('{readOnly && ('), section.indexOf('</header>'))
    expect(readOnlyBlock).toContain('⬇ 导出 PDF')
    expect(readOnlyBlock).toContain('label="⋯"')
    // 只读分支没有修改/编辑/移除主键
    expect(readOnlyBlock).not.toContain('修改这份')
    expect(readOnlyBlock).not.toContain('✎ 编辑')
  })

  it('frozen reader flows untouched: MarkdownDocument semantics and existing entries intact', () => {
    const reader = source('../src/renderer/lesson-material-reader.tsx')
    const section = source('../src/renderer/lesson-files-section.tsx')
    // 打印视图只消费：渲染管线函数原样
    expect(reader).toContain('export function MarkdownDocument({ body, files }')
    expect(reader).toContain('function ManagedMarkdownImage(')
    // 既有入口全部保留
    for (const entry of ['设为讲义底稿', '增强解析', '从本课移除', '所在文件夹', '系统打开']) {
      expect(section).toContain(entry)
    }
    expect(section).toContain('沉浸阅读')
  })
})
