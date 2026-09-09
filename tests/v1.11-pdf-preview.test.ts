import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** V1.11（D66/D68）：PDF 应用内预览——binary 载荷渲染分支与组件结构钉测。 */
describe('V111-B PDF 应用内预览', () => {
  it('reader renders the pdf branch for binary payloads and keeps the fallback escape hatch', () => {
    const reader = source('../src/renderer/lesson-material-reader.tsx')
    // binary + pdf MIME → PdfPreview；非 pdf 的 binary（本版无渲染方）→ 系统打开兜底
    expect(reader).toContain("content?.kind === 'binary' && content.file.mimeType === 'application/pdf'")
    expect(reader).toContain('<PdfPreview dataUrl={content.dataUrl} />')
    expect(reader).toContain('pdf-preview-fallback')
    expect(reader).toContain('用系统应用打开')
    // 既有 text/image/unsupported 分支保持
    expect(reader).toContain("content?.kind === 'text' && <MarkdownDocument")
    expect(reader).toContain("content?.kind === 'image'")
    expect(reader).toContain("content?.kind === 'unsupported'")
  })

  it('PdfPreview is a static import (renderer boundary) with pdfjs worker via the Vite asset pipeline', () => {
    const component = source('../src/renderer/pdf-preview.tsx')
    // 渲染器边界：静态 import（无 dynamic import/require），pdfjs 只经 npm 包进 bundle
    expect(component).toContain("import { Document, Page, pdfjs } from 'react-pdf'")
    expect(component).not.toContain('import(')
    // worker 与使用方同模块（react-pdf 约束）
    expect(component).toContain("pdfjs.GlobalWorkerOptions.workerSrc = new URL(\n  'pdfjs-dist/build/pdf.worker.min.mjs',\n  import.meta.url,\n).toString()")
    // 只读面：无文本层/无注解层（无链接跳转面）
    expect(component).toContain('renderTextLayer={false}')
    expect(component).toContain('renderAnnotationLayer={false}')
  })

  it('node test environment provides the pdfjs module-scope DOMMatrix stub via vitest setup', () => {
    const setup = source('./setup-node-dom-stubs.ts')
    expect(setup).toContain('DOMMatrix')
    const config = source('../vitest.config.ts')
    expect(config).toContain("setupFiles: ['tests/setup-node-dom-stubs.ts']")
  })

  it('dataUrl → Uint8Array decode utility stays DOM-free and testable', () => {
    const binary = source('../src/renderer/pdf-binary.ts')
    expect(binary).toContain('export function dataUrlToUint8Array')
    expect(binary).toContain('window.atob')
  })

  it('dependency whitelist: react-pdf added, nothing else new beyond the frozen set', () => {
    const pkg = JSON.parse(source('../package.json')) as { dependencies: Record<string, string> }
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      'better-sqlite3',
      'katex',
      'officeparser',
      'react',
      'react-dom',
      'react-pdf',
    ])
  })

  it('styles: pdf preview group present', () => {
    const styles = source('../src/renderer/styles.css')
    expect(styles).toContain('.pdf-preview {')
    expect(styles).toContain('.pdf-preview-fallback {')
  })

  it('main service keeps the pdf binary whitelist (pdf yes, legacy office no)', () => {
    const service = source('../src/main/files/managed-file-service.ts')
    expect(service).toContain("function isPreviewableBinary(mimeType: string): boolean")
    expect(service).toContain("mimeType === 'application/pdf'")
    expect(service).toContain("mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'")
    expect(service).not.toContain("mimeType === 'application/msword'")
  })
})
