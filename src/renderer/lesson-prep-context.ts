import type { CourseMode, NodeRecord, StudentRecord } from '../shared/core-contracts'
import type { LessonMaterialGroup, ManagedFileOverview, ManagedFileRecord } from '../shared/file-contracts'
import { normalizeMarkdownImageReferences } from './rich-text'

export interface LessonMaterialTreeNode {
  readonly file: ManagedFileRecord
  readonly children: readonly ManagedFileRecord[]
}

export interface LessonPrepContext {
  readonly courseId: string
  readonly courseTitle: string
  readonly courseMode: CourseMode
  readonly lessonId: string
  readonly lessonTitle: string
  readonly lessonLabel?: string
  readonly periodTitle?: string
  readonly studentId?: string
  readonly studentNames: readonly string[]
}

export interface LessonMaterialFilterOptions {
  readonly lessonLabel?: string
  readonly periodTitle?: string
}

export interface LessonCoursewareFiles {
  readonly currentVersion: ManagedFileRecord | null
  readonly history: readonly ManagedFileRecord[]
  readonly currentMaterials: readonly ManagedFileRecord[]
}

const lessonVersionPattern = / · 第 (\d+) 版\.md$/u

export function createLessonPrepContext(
  course: NodeRecord,
  lesson: NodeRecord,
  students: readonly StudentRecord[],
  periodTitle?: string,
): LessonPrepContext {
  const courseMode = course.courseMode ?? 'class'
  const normalizedPeriodTitle = periodTitle?.trim()
  return {
    courseId: course.id,
    courseTitle: course.title,
    courseMode,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    ...(lesson.lessonLabel === undefined ? {} : { lessonLabel: lesson.lessonLabel }),
    ...(normalizedPeriodTitle === undefined || normalizedPeriodTitle === '' ? {} : { periodTitle: normalizedPeriodTitle }),
    ...(courseMode === 'one_to_one' && students[0] !== undefined
      ? { studentId: students[0].id }
      : {}),
    studentNames: students.map((student) => student.name),
  }
}

export function listLessonPrepFiles(
  overview: ManagedFileOverview,
  lessonId: string,
): ManagedFileRecord[] {
  const linkedIds = new Set(overview.links
    .filter((link) => link.targetType === 'lesson' && link.targetId === lessonId)
    .map((link) => link.fileId))
  return overview.files.filter((file) => file.deletedAt === null && linkedIds.has(file.id))
}

export function reconcileSelectedLessonFileIds(
  currentSelectedIds: readonly string[],
  previousKnownIds: ReadonlySet<string>,
  currentFiles: readonly ManagedFileRecord[],
): string[] {
  const currentIds = currentFiles.filter(isSelectableLessonPrepFile).map((file) => file.id)
  const currentSet = new Set(currentIds)
  const stillPresent = currentSelectedIds.filter((id) => currentSet.has(id))
  const newlyAdded = currentIds.filter((id) => !previousKnownIds.has(id))
  return [...new Set([...stillPresent, ...newlyAdded])]
}

export function isSelectableLessonPrepFile(file: ManagedFileRecord): boolean {
  return !file.mimeType.startsWith('image/')
}

/** V1.7.2：课次文件来源小标签（生成依据/参考候选列表用）。 */
export type LessonFileSourceLabel = '外部资料' | '素材库'

const appGeneratedNamePattern = /(?: · 第 \d+ 版(?: · 学生版)?|（编辑版）)\.md$/u

/**
 * V1.7.2 来源判定（数据层实证，见 managed-file-service）：
 * - 素材库复制（files:copy-to-lesson）必留 originFileId = 源文件 id → 「素材库」；
 * - 工作台 AI 发布（` · 第 N 版.md`，含学生版）与人工编辑保存（`（编辑版）.md`）按命名排除，不标来源；
 * - 其余一律标「外部资料」——外部资料 picker（external:copy-to-lesson → importToLesson）的
 *   originFileId 为 null；题库题目复制（importToLesson 同路径）与历史课程包脚本导入同特征，
 *   实质都是"工作台外进来的资料"，统一按外部资料展示（准确来源需迁移新增列，超出展示层范围）。
 */
export function lessonFileSourceLabel(file: ManagedFileRecord): LessonFileSourceLabel | null {
  if (appGeneratedNamePattern.test(file.originalName)) return null
  return file.originFileId === null ? '外部资料' : '素材库'
}

/** D27（V17-B）：任意 text/markdown managed 文件均可作 AI 修改对象（含外部导入 md）；office/pdf/图片/纯文本不在其列。 */
export function isAiEditableFile(file: ManagedFileRecord): boolean {
  return file.mimeType === 'text/markdown'
}

/**
 * D23 历史判断保留（V17-B 起仅用于版本链命名与排序，不再作修改准入）：
 * 工作台发布的“标题 · 第 N 版.md”。
 */
export function isAppGeneratedCoursewareFile(file: ManagedFileRecord): boolean {
  return file.mimeType === 'text/markdown' && lessonVersionPattern.test(file.originalName)
}

/** V1.8.1/D46：讲义命名——版本链（` · 第 N 版.md`）与人工编辑副本（`（编辑版）.md`）计入讲义组；其余挂课文件归材料组。 */
const lectureCoursewareNamePattern = /(?: · 第 \d+ 版(?: · 学生版)?|（编辑版）)\.md$/u

/** V1.8.1/D46：单文件讲义判定（提讲义入口用它隐藏已是讲义的文件）。 */
export function isLessonLectureFile(file: ManagedFileRecord): boolean {
  return file.mimeType === 'text/markdown' && lectureCoursewareNamePattern.test(file.originalName)
}

export interface LessonFilesByRole {
  readonly lecture: readonly ManagedFileRecord[]
  readonly materials: readonly ManagedFileRecord[]
}

/** V1.13/D75：材料四组元数据（组序 = 展示序）。 */
export const LESSON_MATERIAL_GROUP_META: Record<
  LessonMaterialGroup,
  { readonly icon: string; readonly label: string; readonly emptyText: string }
> = {
  lecture: { icon: '📘', label: '本课讲义', emptyText: '还没有讲义——选中材料区的 Markdown 可「设为讲义底稿」，或用 AI 生成第一版课件。' },
  exercise: { icon: '✏️', label: '习题与作业', emptyText: '本课还没有习题与作业。' },
  exam: { icon: '📄', label: '试卷与复习', emptyText: '本课还没有试卷与复习资料。' },
  misc: { icon: '📎', label: '其他资料', emptyText: '本课还没有其他资料。' },
}

/** V1.13/D75：分组上下文——课次标题 + 本课全部挂课文件 + md 正文快照（规则 6 需要）。 */
export interface LessonMaterialGroupContext {
  readonly lessonTitle: string
  readonly files: readonly ManagedFileRecord[]
  readonly markdownBodies: ReadonlyMap<string, string>
}

const lessonMaterialExercisePattern = /习题|作业|题目|答案|真题|练习/u
const lessonMaterialExamPattern = /试卷|卷子|期中|期末|一模|二模|月考|复习|错题|专项|填选|选填/u
const lessonMaterialLecturePattern = /讲义|精讲|补充|例题|教师版|学生版/u

function nameWithoutExtension(originalName: string): string {
  return originalName.replace(/\.[^.]+$/u, '')
}

/**
 * V1.13/D75：启发式归组——冻结顺序规则表，首中即停：
 * 1) D46 讲义命名 → lecture；2) 习题作业关键词 → exercise；3) 试卷复习关键词 → exam；
 * 4) 讲义类关键词（「补充讲义」= 讲义+习题一体系统，产品负责人裁决归 lecture）→ lecture；
 * 5) 文件名主干与课次标题互相包含（≥2 字符）→ lecture；
 * 6) md 正文引用非图片本地文件（薄壳外链容器）→ lecture；7) 兜底 → misc。
 * 规则识别错由手动改组（lesson_files.role）兜底。
 */
export function lessonMaterialGroupRole(
  file: ManagedFileRecord,
  context: LessonMaterialGroupContext,
): LessonMaterialGroup {
  if (isLessonLectureFile(file)) return 'lecture'
  const name = nameWithoutExtension(file.originalName)
  if (lessonMaterialExercisePattern.test(name)) return 'exercise'
  if (lessonMaterialExamPattern.test(name)) return 'exam'
  if (lessonMaterialLecturePattern.test(name)) return 'lecture'
  const title = context.lessonTitle.trim()
  const stem = name.trim()
  if (title.length >= 2 && stem.length >= 2 && (stem.includes(title) || title.includes(stem))) {
    return 'lecture'
  }
  if (file.mimeType === 'text/markdown') {
    const body = context.markdownBodies.get(file.id)
    if (body !== undefined) {
      const attachmentFiles = context.files.filter(
        (candidate) => candidate.mimeType !== 'text/markdown' && !candidate.mimeType.startsWith('image/'),
      )
      for (const reference of extractResourceReferences(body)) {
        if (findReferencedFiles(attachmentFiles, reference).length > 0) return 'lecture'
      }
    }
  }
  return 'misc'
}

/** V1.8.1/D46 方案 A：课件区目录树分组（纯展示，不改变文件获取与既有 classify 管线）。 */
export function splitLessonFilesByRole(files: readonly ManagedFileRecord[]): LessonFilesByRole {
  const lecture: ManagedFileRecord[] = []
  const materials: ManagedFileRecord[] = []
  // V1.13/D76 语义演进：讲义组 = lecture 组（含导入讲义）；材料组 = 习题/试卷/其他三组之和。
  // 此处无 md 正文快照（规则 6 不可用），课程页行动卡计数场景足够。
  const context: LessonMaterialGroupContext = { lessonTitle: '', files, markdownBodies: new Map() }
  for (const file of files) {
    if (lessonMaterialGroupRole(file, context) === 'lecture') lecture.push(file)
    else materials.push(file)
  }
  return { lecture, materials }
}

/** 修改候选排序（V17-B）：版本链最新版在前，其余 md 依原序跟后。 */
export function orderAiEditableFiles(files: readonly ManagedFileRecord[]): ManagedFileRecord[] {
  const versioned = files
    .map((file) => {
      const match = lessonVersionPattern.exec(file.originalName)
      return match === null ? null : { file, version: Number(match[1]) }
    })
    .filter((item): item is { file: ManagedFileRecord; version: number } => item !== null)
    .sort((left, right) => right.version - left.version)
  const versionedIds = new Set(versioned.map((item) => item.file.id))
  return [...versioned.map((item) => item.file), ...files.filter((file) => !versionedIds.has(file.id))]
}

export function classifyLessonCoursewareFiles(
  files: readonly ManagedFileRecord[],
): LessonCoursewareFiles {
  const versioned = files
    .map((file) => {
      const match = lessonVersionPattern.exec(file.originalName)
      return match === null ? null : { file, version: Number(match[1]) }
    })
    .filter((item): item is { file: ManagedFileRecord; version: number } => item !== null)
    .sort((left, right) => right.version - left.version)
  const currentVersion = versioned[0]?.file ?? null
  const history = versioned.slice(1).map((item) => item.file)
  const historyIds = new Set(history.map((file) => file.id))
  const currentMaterials = currentVersion === null
    ? files.filter((file) => !historyIds.has(file.id))
    : [
        currentVersion,
        ...files.filter((file) => file.id !== currentVersion.id && !historyIds.has(file.id)),
      ]
  return { currentVersion, history, currentMaterials }
}

export function filterLessonMaterialFiles(
  files: readonly ManagedFileRecord[],
  options: LessonMaterialFilterOptions = {},
): ManagedFileRecord[] {
  return files.filter((file) => !isStructuralLessonIndexFile(file, options))
}

function isStructuralLessonIndexFile(
  file: ManagedFileRecord,
  options: LessonMaterialFilterOptions,
): boolean {
  if (file.mimeType !== 'text/markdown') return false
  const baseName = file.originalName.replace(/\.(?:md|markdown)$/iu, '').trim()
  if (baseName === '' || /反馈/u.test(baseName)) return false

  const lessonLabel = options.lessonLabel?.trim()
  if (lessonLabel !== undefined && lessonLabel !== '' && baseName === lessonLabel) return true

  const periodTitle = options.periodTitle?.trim()
  if (periodTitle !== undefined && periodTitle !== '' && baseName === periodTitle) return true

  // 导出的思源目录索引会以“第X课/讲”或“年级/升学阶段+季节”命名。
  // 这些文件代表文件夹入口，不应在某一节课的正文资料中重复出现。
  // 只有裸编号（如“第12讲”“第3课”）才是目录索引；带主题后缀（如“第1讲 实数综合”）是真实内容。
  if (/^第.+?(?:课|讲)\s*$/u.test(baseName)) return true
  if (/(?:年级|升).*(?:春|秋|寒|暑)|(?:春|秋|寒|暑)假/u.test(baseName)) return true
  return baseName === '总课程大纲'
}

export function buildLessonMaterialTree(
  files: readonly ManagedFileRecord[],
  markdownBodies: ReadonlyMap<string, string>,
): LessonMaterialTreeNode[] {
  const childrenByParent = new Map<string, ManagedFileRecord[]>()
  const referencedChildIds = new Set<string>()
  const resourceFiles = files.filter((file) => file.mimeType !== 'text/markdown')

  for (const parent of files.filter((file) => file.mimeType === 'text/markdown')) {
    const body = markdownBodies.get(parent.id)
    if (body === undefined) continue
    for (const reference of extractResourceReferences(body)) {
      const matches = findReferencedFiles(resourceFiles, reference)
      if (matches.length === 0) continue
      const children = childrenByParent.get(parent.id) ?? []
      for (const child of matches) {
        if (children.some((existing) => existing.id === child.id)) continue
        children.push(child)
        referencedChildIds.add(child.id)
      }
      childrenByParent.set(parent.id, children)
    }
  }

  return files
    .filter((file) => !referencedChildIds.has(file.id))
    .map((file) => ({
      file,
      children: childrenByParent.get(file.id) ?? [],
    }))
}

/** V1.13/D76：树节点级四组分组（树构建不变，仅切分组桶；手动覆盖由调用方先并入 effective role）。 */
export function groupLessonMaterialNodes(
  nodes: readonly LessonMaterialTreeNode[],
  effectiveRole: (file: ManagedFileRecord) => LessonMaterialGroup,
): Record<LessonMaterialGroup, LessonMaterialTreeNode[]> {
  const buckets: Record<LessonMaterialGroup, LessonMaterialTreeNode[]> = {
    lecture: [],
    exercise: [],
    exam: [],
    misc: [],
  }
  for (const node of nodes) buckets[effectiveRole(node.file)].push(node)
  return buckets
}

function extractResourceReferences(body: string): string[] {
  const references: string[] = []
  const pattern = /(?:!\[[^\]]*\]|\[[^\]]+\])\((?:<([^>]+)>|([^)]*))\)/gu
  const normalizedBody = normalizeMarkdownImageReferences(body)
  let match: RegExpExecArray | null
  while ((match = pattern.exec(normalizedBody)) !== null) {
    const rawReference = (match[1] ?? match[2] ?? '').trim()
    if (rawReference === '' || /^(?:https?:|data:|#)/iu.test(rawReference)) continue
    references.push(rawReference.split(/\s+['"]/u)[0])
  }
  return references
}

function findReferencedFiles(
  files: readonly ManagedFileRecord[],
  reference: string,
): ManagedFileRecord[] {
  const normalized = normalizeReferenceName(reference)
  if (normalized === '') return []
  return files.filter((file) => file.originalName.toLocaleLowerCase('zh-CN') === normalized)
}

function normalizeReferenceName(reference: string): string {
  const withoutQuery = reference.trim().split(/[?#]/u)[0]
  const name = withoutQuery.split(/[\\/]/u).at(-1) ?? ''
  try {
    return decodeURIComponent(name).toLocaleLowerCase('zh-CN')
  } catch {
    return name.toLocaleLowerCase('zh-CN')
  }
}
