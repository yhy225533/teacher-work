import { readFile } from 'node:fs/promises'

import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { convertMetafile } from '../src/renderer/docx-metafile-converter'
import { preprocessDocx, type MetafileConverter } from '../src/renderer/docx-preprocess'

describe('V1.17.1 emf-converter adapter', () => {
  it('uses emf-converter and no longer references rtf.js', async () => {
    const path = new URL('../src/renderer/docx-metafile-converter.ts', import.meta.url)
    const text = await readFile(path, 'utf8')
    expect(text).toContain("from 'emf-converter'")
    expect(text).toContain('convertMetafileToSvg')
    expect(text).not.toContain('rtf.js')
  })

  it('returns null for invalid metafile bytes', async () => {
    await expect(convertMetafile(new Uint8Array([1, 2, 3, 4]), 'emf')).resolves.toBeNull()
  })

  it('accepts an asynchronous converter in the existing preprocess chain', async () => {
    const asyncConverter: MetafileConverter = async () => '<svg><path d="M0 0L1 1"/></svg>'
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types/>')
    zip.file('word/document.xml', '<w:document/>')
    zip.file('word/media/image1.emf', new Uint8Array([1, 2, 3]))
    const input = await zip.generateAsync({ type: 'arraybuffer' })
    const result = await preprocessDocx(input, asyncConverter)
    expect(result.converted).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.bytes).not.toBe(input)
  })
})
