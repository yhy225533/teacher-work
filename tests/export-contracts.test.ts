import { describe, expect, it } from 'vitest'

import {
  EXPORT_BODY_MD_MAX_CHARS,
  EXPORT_HEADER_TEXT_MAX_CHARS,
  EXPORT_TOTAL_TIMEOUT_MS,
  isExportPrintPayload,
  isExportPrintRequest,
  isExportPrintResult,
  isPrintReadyResult,
} from '../src/shared/export-contracts'

function record(value: Record<string, unknown>): unknown {
  return value
}

describe('V19-D 导出合同（export-contracts）', () => {
  it('pins the frozen constants: header 100 chars, body 200k (write-version parity), timeout 60s', () => {
    expect(EXPORT_HEADER_TEXT_MAX_CHARS).toBe(100)
    expect(EXPORT_BODY_MD_MAX_CHARS).toBe(200_000)
    expect(EXPORT_TOTAL_TIMEOUT_MS).toBe(60_000)
  })

  it('accepts valid print requests and rejects boundary violations', () => {
    expect(isExportPrintRequest(record({ fileId: 'file-1', lessonId: 'lesson-1' }))).toBe(true)
    expect(isExportPrintRequest(record({ fileId: 'file-1', lessonId: 'lesson-1', headerText: '张三 · 第 12 讲' }))).toBe(true)
    // headerText 100 字恰好可过、101 字拒绝
    expect(isExportPrintRequest(record({ fileId: 'f', lessonId: 'l', headerText: '字'.repeat(100) }))).toBe(true)
    expect(isExportPrintRequest(record({ fileId: 'f', lessonId: 'l', headerText: '字'.repeat(101) }))).toBe(false)
    // 非空校验 + 键白名单（hasOnlyKeys：多余键/缺键/注入键全拒绝）
    expect(isExportPrintRequest(record({ fileId: '', lessonId: 'l' }))).toBe(false)
    expect(isExportPrintRequest(record({ fileId: 'f' }))).toBe(false)
    expect(isExportPrintRequest(record({ fileId: 'f', lessonId: 'l', extra: 1 }))).toBe(false)
    expect(isExportPrintRequest(record({ fileId: 'f', lessonId: 'l', headerText: 42 }))).toBe(false)
    expect(isExportPrintRequest(null)).toBe(false)
  })

  it('export result is exactly { saved: boolean } — never a path', () => {
    expect(isExportPrintResult(record({ saved: true }))).toBe(true)
    expect(isExportPrintResult(record({ saved: false }))).toBe(true)
    // V11-01：响应不回传路径——savedPath/任何多余键都会被守卫拒绝
    expect(isExportPrintResult(record({ saved: true, savedPath: 'D:\\out\\a.pdf' }))).toBe(false)
    expect(isExportPrintResult(record({ saved: 'yes' }))).toBe(false)
  })

  it('print payload guard: bodyMd limit parity, files are managed records, meta shape', () => {
    const file = {
      id: 'file-1', originalName: '讲义.md', sizeBytes: 12, mimeType: 'text/markdown',
      originFileId: null, mtimeMs: null, contentHash: null,
      createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z', deletedAt: null,
    }
    const meta = { title: '讲义', headerText: '', exportDate: '2026-09-08' }
    expect(isExportPrintPayload(record({ bodyMd: '# 标题', files: [file], meta }))).toBe(true)
    expect(isExportPrintPayload(record({ bodyMd: 'x'.repeat(EXPORT_BODY_MD_MAX_CHARS), files: [file], meta }))).toBe(true)
    expect(isExportPrintPayload(record({ bodyMd: 'x'.repeat(EXPORT_BODY_MD_MAX_CHARS + 1), files: [file], meta }))).toBe(false)
    expect(isExportPrintPayload(record({ bodyMd: '# 标题', files: [record({ ...file, id: '' })], meta }))).toBe(false)
    expect(isExportPrintPayload(record({ bodyMd: '# 标题', files: [file], meta: record({ title: 'x' }) }))).toBe(false)
    expect(isExportPrintPayload(record({ bodyMd: '# 标题', files: [file], meta, extra: true }))).toBe(false)
  })

  it('print ready result accepts only the literal accepted:true', () => {
    expect(isPrintReadyResult(record({ accepted: true }))).toBe(true)
    expect(isPrintReadyResult(record({ accepted: false }))).toBe(false)
    expect(isPrintReadyResult(record({ accepted: true, retry: true }))).toBe(false)
  })
})
