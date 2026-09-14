export interface ManagedFileRecord {
  readonly id: string
  readonly originalName: string
  readonly sizeBytes: number
  readonly mimeType: string
  readonly originFileId: string | null
  readonly mtimeMs: number | null
  readonly contentHash: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly deletedAt: string | null
}

export type ManagedFileContent =
  | {
      readonly file: ManagedFileRecord
      readonly kind: 'text'
      readonly content: string
    }
  | {
      readonly file: ManagedFileRecord
      readonly kind: 'image'
      readonly dataUrl: string
    }
  | {
      /** V1.11（D68）：PDF/docx 预览载荷——与 image 同构的 dataUrl，渲染端解码为 ArrayBuffer。 */
      readonly file: ManagedFileRecord
      readonly kind: 'binary'
      readonly dataUrl: string
    }
  | {
      readonly file: ManagedFileRecord
      readonly kind: 'unsupported'
      readonly message: string
    }

export type FileLinkTarget = 'lesson' | 'student'

/**
 * V1.13/D74：课件区材料四组（手动覆盖组）。
 * lesson_files.role 只存老师的手动决定；NULL = 自动（渲染端启发式归组）。
 */
export const LESSON_MATERIAL_GROUPS = ['lecture', 'exercise', 'exam', 'misc'] as const

export type LessonMaterialGroup = (typeof LESSON_MATERIAL_GROUPS)[number]

export interface ManagedFileLink {
  readonly fileId: string
  readonly targetType: FileLinkTarget
  readonly targetId: string
  readonly createdAt: string
  /** V1.13/D74：仅 lesson 链接由 Main 填写（null = 自动）；student 链接恒缺省。 */
  readonly role?: LessonMaterialGroup | null
}

export interface ManagedFileOverview {
  readonly files: readonly ManagedFileRecord[]
  readonly links: readonly ManagedFileLink[]
}

export interface ManagedFileRefreshResult {
  readonly file: ManagedFileRecord
  readonly contentChanged: boolean
  readonly hashComputed: boolean
}

export interface ManagedFileContentChanged {
  readonly fileId: string
  readonly contentChanged: true
  readonly file: ManagedFileRecord
}

export interface FileIdRequest {
  readonly fileId: string
}

/** V17-C：md 编辑器保存（D29 永远写新文件，绝不 UPDATE 目标行）。 */
export interface WriteFileVersionRequest {
  readonly fileId: string
  readonly bodyMd: string
  readonly summary?: string
}

export interface WriteFileVersionResult {
  readonly file: ManagedFileRecord
  readonly version: number
}

export interface ReadFileTextResult {
  readonly file: ManagedFileRecord
  readonly content: string
}

export interface CopyFileToLessonRequest {
  readonly fileId: string
  readonly lessonId: string
}

export interface CopyFileToStudentRequest {
  readonly fileId: string
  readonly studentId: string
}

export interface FileActionResult {
  readonly accepted: true
}

/** V1.13/D74：手动改组请求（group = null 恢复自动）。 */
export interface SetLessonMaterialGroupRequest {
  readonly fileId: string
  readonly group: LessonMaterialGroup | null
}

/** V1.14/D82：新建讲义请求（名称清洗校验在 Main 侧 createLessonDoc 再做一遍防御）。 */
export interface CreateLessonDocRequest {
  readonly lessonId: string
  readonly name: string
}

/** V1.13/D77：手动改组响应（返回更新后的文件记录与生效组值）。 */
export interface SetLessonMaterialGroupResult {
  readonly file: ManagedFileRecord
  readonly group: LessonMaterialGroup | null
}

export function isManagedFileRecord(value: unknown): value is ManagedFileRecord {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.originalName) &&
    isNonNegativeNumber(value.sizeBytes) &&
    isNonEmptyString(value.mimeType) &&
    (value.originFileId === null || isNonEmptyString(value.originFileId)) &&
    (value.mtimeMs === null || isFiniteNumber(value.mtimeMs)) &&
    (value.contentHash === null || isNonEmptyString(value.contentHash)) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    (value.deletedAt === null || isNonEmptyString(value.deletedAt))
  )
}

export function isManagedFileContent(value: unknown): value is ManagedFileContent {
  if (!isRecord(value) || !isManagedFileRecord(value.file)) return false
  if (value.kind === 'text') return typeof value.content === 'string'
  if (value.kind === 'image') return isNonEmptyString(value.dataUrl)
  if (value.kind === 'binary') return isNonEmptyString(value.dataUrl) && value.dataUrl.startsWith('data:')
  return value.kind === 'unsupported' && isNonEmptyString(value.message)
}

export function isManagedFileLink(value: unknown): value is ManagedFileLink {
  return (
    isRecord(value) &&
    isNonEmptyString(value.fileId) &&
    (value.targetType === 'lesson' || value.targetType === 'student') &&
    isNonEmptyString(value.targetId) &&
    isNonEmptyString(value.createdAt) &&
    // V1.13/D74：可选 role（缺省 = student 链接/旧载荷）；出现时必须为四组值或 null。
    (value.role === undefined || value.role === null || isLessonMaterialGroup(value.role))
  )
}

export function isLessonMaterialGroup(value: unknown): value is LessonMaterialGroup {
  return typeof value === 'string' && (LESSON_MATERIAL_GROUPS as readonly string[]).includes(value)
}

export function isSetLessonMaterialGroupRequest(value: unknown): value is SetLessonMaterialGroupRequest {
  return (
    hasOnlyKeys(value, ['fileId', 'group']) &&
    isNonEmptyString(value.fileId) &&
    (value.group === null || isLessonMaterialGroup(value.group))
  )
}

/** V1.14/D82：名称清洗规则（trim + 去控制字符；1–80 字）。Main 侧 createLessonDoc 与共享守卫共用同一上限。 */
export const LESSON_DOC_NAME_MAX_CHARS = 80

export function isCreateLessonDocRequest(value: unknown): value is CreateLessonDocRequest {
  return (
    hasOnlyKeys(value, ['lessonId', 'name']) &&
    isNonEmptyString(value.lessonId) &&
    typeof value.name === 'string' &&
    value.name.trim() !== '' &&
    Array.from(value.name).length <= LESSON_DOC_NAME_MAX_CHARS
  )
}

export function isSetLessonMaterialGroupResult(value: unknown): value is SetLessonMaterialGroupResult {
  return (
    isRecord(value) &&
    isManagedFileRecord(value.file) &&
    (value.group === null || isLessonMaterialGroup(value.group))
  )
}

export function isManagedFileOverview(value: unknown): value is ManagedFileOverview {
  return (
    isRecord(value) &&
    Array.isArray(value.files) &&
    value.files.every(isManagedFileRecord) &&
    Array.isArray(value.links) &&
    value.links.every(isManagedFileLink)
  )
}

export function isFileIdRequest(value: unknown): value is FileIdRequest {
  return hasOnlyKeys(value, ['fileId']) && isNonEmptyString(value.fileId)
}

export function isWriteFileVersionRequest(value: unknown): value is WriteFileVersionRequest {
  return (
    hasOnlyKeys(value, ['fileId', 'bodyMd'], ['summary']) &&
    isNonEmptyString(value.fileId) &&
    typeof value.bodyMd === 'string' &&
    value.bodyMd.trim() !== '' &&
    value.bodyMd.length <= 200_000 &&
    (value.summary === undefined || (isNonEmptyString(value.summary) && value.summary.length <= 500))
  )
}

export function isWriteFileVersionResult(value: unknown): value is WriteFileVersionResult {
  return (
    isRecord(value) &&
    isManagedFileRecord(value.file) &&
    typeof value.version === 'number' &&
    Number.isInteger(value.version) &&
    value.version >= 1
  )
}

export function isReadFileTextResult(value: unknown): value is ReadFileTextResult {
  return isRecord(value) && isManagedFileRecord(value.file) && typeof value.content === 'string'
}

export function isCopyFileToLessonRequest(value: unknown): value is CopyFileToLessonRequest {
  return (
    hasOnlyKeys(value, ['fileId', 'lessonId']) &&
    isNonEmptyString(value.fileId) &&
    isNonEmptyString(value.lessonId)
  )
}

export function isCopyFileToStudentRequest(value: unknown): value is CopyFileToStudentRequest {
  return (
    hasOnlyKeys(value, ['fileId', 'studentId']) &&
    isNonEmptyString(value.fileId) &&
    isNonEmptyString(value.studentId)
  )
}

export function isFileActionResult(value: unknown): value is FileActionResult {
  return isRecord(value) && value.accepted === true
}

export function isNullableManagedFileRecord(value: unknown): value is ManagedFileRecord | null {
  return value === null || isManagedFileRecord(value)
}

export function isManagedFileRefreshResult(value: unknown): value is ManagedFileRefreshResult {
  return (
    isRecord(value) &&
    isManagedFileRecord(value.file) &&
    typeof value.contentChanged === 'boolean' &&
    typeof value.hashComputed === 'boolean'
  )
}

export function isManagedFileContentChanged(value: unknown): value is ManagedFileContentChanged {
  return (
    isRecord(value) &&
    isNonEmptyString(value.fileId) &&
    value.contentChanged === true &&
    isManagedFileRecord(value.file)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasOnlyKeys(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false
  }
  const keys = Object.keys(value)
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  return requiredKeys.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key))
}
