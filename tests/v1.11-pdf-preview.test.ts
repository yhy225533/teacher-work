import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** V1.11（D66/D67/D68）：PDF/docx 应用内预览——binary 载荷渲染分支与组件结构钉测。 */
describe('V111-B PDF 应用内预览', () => {
  it('reader renders the pdf branch for binary payloads and keeps the fallback escape hatch', () => {
    const reader = source('../src/renderer/lesson-material-reader.tsx')
    // binary + pdf MIME → PdfPreview；docx MIME → DocxPreview；其余 binary → 系统打开兜底
    expect(reader).toContain("content?.kind === 'binary' && content.file.mimeType === 'application/pdf'")
    expect(reader).toContain('<PdfPreview dataUrl={content.dataUrl} />')
    expect(reader).toContain("content?.kind === 'binary' && content.file.mimeType === DOCX_MIME")
    expect(reader).toContain('<DocxPreview dataUrl={content.dataUrl} />')
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
    // worker 与使用方同模块（react-pdf 约束）——深路径指向 react-pdf 内嵌的配套 v5 worker，
    // 顶层 pdfjs-dist 被 officeparser override 固化为 v6，指顶层会 API≠Worker 版本失配。
    expect(component).toContain("pdfjs.GlobalWorkerOptions.workerSrc = new URL(\n  'react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',\n  import.meta.url,\n).toString()")
    // file 载荷按 dataUrl 记忆化：字面量 file 会在每次重渲染时触发 react-pdf 取消重载（加载永不收敛）。
    expect(component).toContain('const file = useMemo(() => ({ data: dataUrlToUint8Array(dataUrl) }), [dataUrl])')
    expect(component).toContain('file={file}')
    expect(component).not.toContain('file={{ data:')
    // 打开失败的具体错误消息上屏（冒烟诊断依赖；失败态由调用方补系统打开逃生门）
    expect(component).toContain('setLoadError(')
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

  it('dependency whitelist: react-pdf and docx-preview added, nothing else beyond the frozen set', () => {
    const pkg = JSON.parse(source('../package.json')) as { dependencies: Record<string, string> }
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      'better-sqlite3',
      'docx-preview',
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

describe('V111-C Word(docx) 应用内预览', () => {
  it('DocxPreview renders statically (no dynamic import) into a controlled container', () => {
    const component = source('../src/renderer/docx-preview.tsx')
    // 渲染器边界：静态 import + 受控容器 + 卸载清空（textContent 置空），无落盘
    expect(component).toContain("import { renderAsync } from 'docx-preview'")
    expect(component).not.toContain('import(')
    expect(component).toContain('renderAsync(dataUrlToUint8Array(dataUrl).buffer as ArrayBuffer, container')
    expect(component).toContain("container.textContent = ''")
    // V1.12（D72）：内嵌图片 data: URL 化——默认 blob: URL 被 CSP img-src 拦截（图片空白）
    expect(component).toContain('{ inWrapper: true, useBase64URL: true }')
    expect(component).not.toContain('{ inWrapper: true }')
  })

  it('styles: docx preview container present with docx-wrapper sizing constraints', () => {
    const styles = source('../src/renderer/styles.css')
    expect(styles).toContain('.docx-preview {')
    expect(styles).toContain('.docx-preview .docx-wrapper')
    expect(styles).toContain('.docx-preview-state {')
  })

  it('reader keeps .doc/.pptx/.xlsx out of both binary preview branches (via Main whitelist pin)', () => {
    // reader 的 binary 渲染只认 pdf/docx 两个 MIME（DOCX_MIME 常量与 Main 白名单一一对应）；
    // .doc 等其余类型在 Main 侧就返回 unsupported，不经 binary 分支——双重钉住。
    const reader = source('../src/renderer/lesson-material-reader.tsx')
    expect(reader).toContain("const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'")
    expect(reader).not.toContain("mimeType === 'application/msword'")
  })
})
