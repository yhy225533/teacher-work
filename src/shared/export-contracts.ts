import { isManagedFileRecord, type ManagedFileRecord } from './file-contracts'
import { isRecord } from './ipc-contracts'

/**
 * V19-D（D48–D54）：课件导出可打印 PDF 的共享合同。
 * 主窗 Renderer 只能传 fileId/lessonId/显示串；打印载荷由 Main 组装（不信任 Renderer 内容）；
 * 响应只含 `{ saved }`，绝不回传路径（V11-01 边界）。
 */

/** 页眉显示串上限（Renderer 拼好的「学生名 · 课次标题」等，可选）。 */
export const EXPORT_HEADER_TEXT_MAX_CHARS = 100
/** 打印正文上限（与 files:write-version 的 MAX_WRITE_BODY_CHARS 同限）。 */
export const EXPORT_BODY_MD_MAX_CHARS = 200_000
/** 一次导出的总超时（打印窗启动 + 渲染就绪 + printToPDF）。 */
export const EXPORT_TOTAL_TIMEOUT_MS = 60_000

/** 主窗 → Main：请求导出（入口在课件区工具行，V19-E 接线）。 */
export interface ExportPrintRequest {
  readonly fileId: string
  readonly lessonId: string
  readonly headerText?: string
}

/** Main → 主窗：导出结果（取消 = 对话框取消，非错误）。 */
export interface ExportPrintResult {
  readonly saved: boolean
}

/** Main → 打印窗：打印载荷（bodyMd 由 Main 直读 managed 正文；files 供图片按名匹配）。 */
export interface ExportPrintPayload {
  readonly bodyMd: string
  readonly files: readonly ManagedFileRecord[]
  readonly meta: ExportPrintMeta
}

export interface ExportPrintMeta {
  readonly title: string
  readonly headerText: string
  readonly exportDate: string
}

/** 打印窗 → Main：渲染就绪信号（fonts + 图片加载完成）。 */
export interface PrintReadyResult {
  readonly accepted: true
}

function hasOnlyKeys(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  return requiredKeys.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isExportPrintRequest(value: unknown): value is ExportPrintRequest {
  return (
    hasOnlyKeys(value, ['fileId', 'lessonId'], ['headerText']) &&
    isNonEmptyString(value.fileId) &&
    isNonEmptyString(value.lessonId) &&
    (value.headerText === undefined || (typeof value.headerText === 'string' && value.headerText.length <= EXPORT_HEADER_TEXT_MAX_CHARS))
  )
}

export function isExportPrintResult(value: unknown): value is ExportPrintResult {
  return isRecord(value) && hasOnlyKeys(value, ['saved']) && typeof value.saved === 'boolean'
}

export function isExportPrintPayload(value: unknown): value is ExportPrintPayload {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['bodyMd', 'files', 'meta']) &&
    typeof value.bodyMd === 'string' &&
    value.bodyMd.length <= EXPORT_BODY_MD_MAX_CHARS &&
    Array.isArray(value.files) &&
    value.files.every(isManagedFileRecord) &&
    isRecord(value.meta) &&
    hasOnlyKeys(value.meta, ['title', 'headerText', 'exportDate']) &&
    typeof value.meta.title === 'string' &&
    typeof value.meta.headerText === 'string' &&
    typeof value.meta.exportDate === 'string'
  )
}

export function isPrintReadyResult(value: unknown): value is PrintReadyResult {
  return isRecord(value) && hasOnlyKeys(value, ['accepted']) && value.accepted === true
}
