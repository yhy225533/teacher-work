import type { CourseMode, NodeRecord, StudentRecord } from '../shared/core-contracts'
import type { LessonMaterialGroup, ManagedFileOverview, ManagedFileRecord } from '../shared/file-contracts'
import { normalizeMarkdownImageReferences } from './rich-text'

export interface LessonMaterialTreeNode {
  readonly file: ManagedFileRecord
  readonly children: readonly ManagedFileRecord[]
}

/**
 * V1.15/D88：答案归属覆盖——childFileId → parentFileId（来自 lesson_files.pair_parent_file_id）。
 * 值为 FILE_PAIR_DETACHED 时表示老师显式解除（不参与自动配对）；未覆盖的文件走保守自动配对。
 */
export type LessonMaterialPairOverrides = ReadonlyMap<string, string>

export interface LessonMaterialTreeOptions {
  readonly pairOverrides?: LessonMaterialPairOverrides
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
  /** V1.14/D86：链头集合（各版本链最高版 + 非版本链讲义不在此列；hover ✕ 白名单扩至全部链头）。 */
  readonly lectureChainHeads: ReadonlySet<string>
}

const lessonVersionPattern = / · 第 (\d+) 版\.md$/u

/** V1.14/D86：版本链基名（`基名 · 第 N 版.md` 去尾部版本段；非版本链文件返回 null）。 */
export function lectureChainBaseName(name: string): string | null {
  const match = lessonVersionPattern.exec(name)
  return match === null ? null : name.slice(0, match.index)
}

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

/**
 * V1.14/D84-3：树行来源徽标降噪——「外部资料」是默认来源无信息量，徽标只显示「素材库」
 * （工作台产物本就为 null）。完整来源标签保留 `lessonFileSourceLabel` 给胶囊等场景。
 */
export function lessonFileBadgeLabel(file: ManagedFileRecord): LessonFileSourceLabel | null {
  const label = lessonFileSourceLabel(file)
  return label === '外部资料' ? null : label
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

/** V1.13/D75：材料四组元数据（组序 = 展示序；V1.14/D84 空组一行化后 emptyText 退役，仅保留 icon/label）。 */
export const LESSON_MATERIAL_GROUP_META: Record<
  LessonMaterialGroup,
  { readonly icon: string; readonly label: string; readonly emptyText: string }
> = {
  lecture: { icon: '📘', label: '本课讲义', emptyText: '' },
  exercise: { icon: '✏️', label: '习题与作业', emptyText: '' },
  exam: { icon: '📄', label: '试卷与复习', emptyText: '' },
  misc: { icon: '📎', label: '其他资料', emptyText: '' },
}

/** V1.13/D75：分组上下文——课次标题 + 本课全部挂课文件 + md 正文快照（规则 6 需要）。 */
export interface LessonMaterialGroupContext {
  readonly lessonTitle: string
  /** V1.15.1/D89：阶段（period）标题——规则 5 的第二主题候选，课次标题为通用序号时的兜底信号。 */
  readonly periodTitle?: string
  readonly files: readonly ManagedFileRecord[]
  readonly markdownBodies: ReadonlyMap<string, string>
}

const lessonMaterialExercisePattern = /习题|作业|题目|答案|真题|练习|特训|精练|全解全析|分层|\d{1,3}题/u
const lessonMaterialExamPattern = /试卷|卷子|期中|期末|一模|二模|月考|复习|错题|专项|填选|选填/u
const lessonMaterialLecturePattern = /讲义|精讲|补充|例题|教师版|学生版/u

function nameWithoutExtension(originalName: string): string {
  return originalName.replace(/\.[^.]+$/u, '')
}

/** 纯通用词主题（「第一讲」「课时2」这类）：单独出现时无主题信息，不能作规则 5 的匹配依据。 */
const genericTopicPattern = /^(?:第[\d一二三四五六七八九十百]+[讲课时节次篇单元]|[\d一二三四五六七八九十百]+[讲课时节次篇单元]|[（(]?\d{1,3}[）)]?|课时|课次|面授|线上|线下)$/u

/** 课次标题里的课时尾缀（「相似三角形模型 第2课时」→ 主题「相似三角形模型」）。 */
const lessonTitlePeriodSuffixPattern = /[\s·\-—]*第\s*[\d一二三四五六七八九十百]+\s*课时$/u

/** 中文数字 → 阿拉伯数字（1–99）。只在明确的序号位置替换，绝不逐字全局替换——
 *「全等三角形」的「三」、「二次根式」的「二」是词素不是数字，全局替换会把文件名改坏。 */
const chineseDigitMap: Record<string, string> = {
  一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9',
}

/** 十位以上（十一、二十三…）。 */
function chineseTwoDigitToArabic(match: string): string {
  const rest = match.slice(1)
  return rest === '' ? '10' : `1${chineseDigitMap[rest]}`
}

/**
 * 规则 5 的主题比较前做归一，让「同一节课的不同写法」能对上：
 * - 去空白：「AMC8不等式」↔「AMC8 不等式」；
 * - 中文数字 ↔ 阿拉伯数字：「AMC8不等式（一）」↔「AMC8 不等式（1）」（实测语料两种写法混用）。
 * 中文数字只在「其一」「（一）」「第一讲」这类序号位置转换。
 */
function normalizeTopicText(value: string): string {
  return value
    .replace(/\s+/gu, '')
    // 全角括号/斜杠 → 半角：实测语料里「不等式（1）」与「不等式(1)」、「A／B」与「A/B」混用
    .replace(/[（]/gu, '(')
    .replace(/[）]/gu, ')')
    .replace(/[／]/gu, '/')
    // 括号序号：（一）(二) → (1)(2)
    .replace(/\(([一二三四五六七八九十]{1,3})\)/gu, (_m, num: string) => `(${chineseNumeralToArabic(num)})`)
    // 「第N讲/课/课时/章」：第十七讲 → 第17讲
    .replace(/第([一二三四五六七八九十]{1,3})(?=[讲课时节次篇单元])/gu, (_m, num: string) => `第${chineseNumeralToArabic(num)}`)
    // 名字结尾的序号（「韦达定理二」）——仅当结尾是纯中文数字时才转换。
    .replace(/([一二三四五六七八九十]{1,3})$/u, (_m, num: string) => chineseNumeralToArabic(num))
}

/** 「一」…「九十九」→ 1…99（仅接受纯中文数字串）。 */
function chineseNumeralToArabic(numeral: string): string {
  if (numeral === '十') return '10'
  if (numeral.startsWith('十')) return chineseTwoDigitToArabic(numeral)
  if (numeral.length === 1) return chineseDigitMap[numeral] ?? numeral
  const [tens, ones] = numeral.split('十')
  if (tens === undefined || ones === undefined) return numeral
  return `${chineseDigitMap[tens] ?? tens}${chineseDigitMap[ones] ?? ones}`
}

/**
 * V1.15.1/D89：规则 5 的主题候选——课次标题（先剥「第N课时」尾缀）+ 阶段标题。
 * 判定改为方向敏感的「文件名主干包含主题」：阶段标题（如「AMC8 不等式（一）」）常比课次标题
 * 更长，双向包含会漏判；反向不判定，避免「英语词汇.md」被短主题误判为讲义。
 * 两段式：先取全部非通用主题（课次 + 阶段），一个都没命中时再退回通用主题（「第二讲」类
 * 通用课次名，此时阶段标题就是唯一主题）。
 */
function lessonTopicTitles(context: LessonMaterialGroupContext): string[] {
  const candidates = [context.lessonTitle.replace(lessonTitlePeriodSuffixPattern, ''), context.periodTitle ?? '']
    .map((title) => title.trim())
    .filter((title) => title.length >= 2)
  const specific = candidates.filter((title) => !genericTopicPattern.test(title))
  return specific.length > 0 ? specific : candidates
}

/**
 * V1.13/D75：启发式归组——冻结顺序规则表，首中即停：
 * 1) D46 讲义命名 → lecture；2) 习题作业关键词 → exercise；3) 试卷复习关键词 → exam；
 * 4) 讲义类关键词（「补充讲义」= 讲义+习题一体系统，产品负责人裁决归 lecture）→ lecture；
 * 5) 文件名主干与主题名互相包含（≥2 字符）→ lecture；
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
  const stem = normalizeTopicText(name)
  if (stem.length >= 2 && lessonTopicTitles(context).some((topic) => stem.includes(normalizeTopicText(topic)))) {
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

/**
 * 修改候选排序（V17-B；V1.14/D86 分链演进）：链头在前、同链相邻（链内版本降序），
 * 链间按链头 createdAt 降序（主讲义链最先，与 classify 的主讲义语义一致），非链 md 依原序跟后。
 */
export function orderAiEditableFiles(files: readonly ManagedFileRecord[]): ManagedFileRecord[] {
  const chains = new Map<string, { file: ManagedFileRecord; version: number }[]>()
  const nonChain: ManagedFileRecord[] = []
  for (const file of files) {
    const match = lessonVersionPattern.exec(file.originalName)
    if (match === null) { nonChain.push(file); continue }
    const base = file.originalName.slice(0, match.index)
    const bucket = chains.get(base) ?? []
    bucket.push({ file, version: Number(match[1]) })
    chains.set(base, bucket)
  }
  const orderedChains = [...chains.values()]
    .map((bucket) => bucket.sort((left, right) => right.version - left.version))
    .sort((left, right) =>
      right[0].file.createdAt.localeCompare(left[0].file.createdAt)
      || right[0].file.id.localeCompare(left[0].file.id))
  return [...orderedChains.flatMap((bucket) => bucket.map((item) => item.file)), ...nonChain]
}

export function classifyLessonCoursewareFiles(
  files: readonly ManagedFileRecord[],
): LessonCoursewareFiles {
  // V1.14/D86 分链：按基名聚合版本链（`基名 · 第 N 版.md`），每链最高版进 currentMaterials、
  // 其余入 history（按链分组）。修复单链假设——不同基名的第二链不再被误吞进历史。
  const chains = new Map<string, { file: ManagedFileRecord; version: number }[]>()
  for (const file of files) {
    const match = lessonVersionPattern.exec(file.originalName)
    if (match === null) continue
    const base = file.originalName.slice(0, match.index)
    const bucket = chains.get(base) ?? []
    bucket.push({ file, version: Number(match[1]) })
    chains.set(base, bucket)
  }
  const chainHeads: ManagedFileRecord[] = []
  const history: ManagedFileRecord[] = []
  for (const bucket of chains.values()) {
    bucket.sort((left, right) => right.version - left.version)
    chainHeads.push(bucket[0].file)
    history.push(...bucket.slice(1).map((item) => item.file))
  }
  // 主讲义 = 最近保存的链（链头 createdAt 最新；保存新版本即新建文件记录）。
  chainHeads.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
  const currentVersion = chainHeads[0] ?? null
  const historyIds = new Set(history.map((file) => file.id))
  const currentMaterials = [
    ...chainHeads,
    ...files.filter((file) => !historyIds.has(file.id) && !chainHeads.some((head) => head.id === file.id)),
  ]
  return {
    currentVersion,
    history,
    currentMaterials,
    lectureChainHeads: new Set(chainHeads.map((head) => head.id)),
  }
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
  options: LessonMaterialTreeOptions = {},
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

  // V1.15/D88：答案归属——md 子（题目 ↔ 答案）也纳入父子表。
  // 两遍处理保证与迭代顺序无关：①先落全部手动覆盖（含解除）；②再对无覆盖者自动配对。
  const markdownIds = new Set(files.filter((file) => file.mimeType === 'text/markdown').map((file) => file.id))
  // 资源嵌套的子项 + 手动指定为子的项——这些都不能再作父（单层语义，防成环）。
  const takenAsChild = new Set(referencedChildIds)
  const manualPairs: Array<{ readonly childId: string; readonly parentId: string }> = []
  for (const [childId, parentId] of options.pairOverrides ?? []) {
    if (!markdownIds.has(childId) || !markdownIds.has(parentId)) continue
    if (childId === parentId) continue
    if (takenAsChild.has(childId)) continue
    // 父若已是别处子项，则本对手动覆盖非法——跳过而非反向破坏既有嵌套。
    if (takenAsChild.has(parentId)) continue
    manualPairs.push({ childId, parentId })
    takenAsChild.add(childId)
  }
  for (const pair of manualPairs) {
    const children = childrenByParent.get(pair.parentId) ?? []
    const child = files.find((candidate) => candidate.id === pair.childId)
    if (child === undefined) continue
    if (children.some((existing) => existing.id === child.id)) continue
    children.push(child)
    childrenByParent.set(pair.parentId, children)
  }
  // 自动配对：仅作用于无手动覆盖的答案类 md；父候选（非答案 md）不能是子项。
  for (const child of files) {
    if (child.mimeType !== 'text/markdown') continue
    if (takenAsChild.has(child.id)) continue
    if (options.pairOverrides?.has(child.id) === true) continue
    const parentId = resolveAutoAnswerParentId(child, files, markdownBodies)
    if (parentId === null || parentId === child.id || !markdownIds.has(parentId)) continue
    if (takenAsChild.has(parentId)) continue
    const children = childrenByParent.get(parentId) ?? []
    if (children.some((existing) => existing.id === child.id)) continue
    children.push(child)
    childrenByParent.set(parentId, children)
    takenAsChild.add(child.id)
  }

  return files
    .filter((file) => !takenAsChild.has(file.id))
    .map((file) => ({
      file,
      children: childrenByParent.get(file.id) ?? [],
    }))
}

/**
 * V1.15/D88：保守自动配对——只在无歧义时给答案类 md 找父文件，首中即停：
 * 1) 显式链接：答案 md 正文引用本课另一 md → 配对（md→md 引用即归属信号）；
 * 2) 主干包含：答案名去掉答案类词干后的主干，与**恰好一个**本课非答案 md 主干互为包含
 *    （主干长度 ≥ 3，避免 `代数` 这类过短词误配）→ 配对。
 * 多候选一律不配对（交老师手动指定，避免误配高后悔动作）。
 */
const lessonMaterialAnswerPattern = /答案|解析|解答|核对表|全解全析|详解|教师版/u

export function isLessonAnswerFileName(originalName: string): boolean {
  return lessonMaterialAnswerPattern.test(originalName.replace(/\.[^.]+$/u, ''))
}

/** 主干包含匹配的最短长度——低于此长度（如「代数」）视为信号不足，交手动。 */
const ANSWER_STEM_MIN_CHARS = 3

export function resolveAutoAnswerParentId(
  child: ManagedFileRecord,
  files: readonly ManagedFileRecord[],
  markdownBodies: ReadonlyMap<string, string>,
): string | null {
  if (!isLessonAnswerFileName(child.originalName)) return null
  const markdownFiles = files.filter((file) => file.mimeType === 'text/markdown' && file.id !== child.id)
  const questionFiles = markdownFiles.filter((file) => !isLessonAnswerFileName(file.originalName))
  if (questionFiles.length === 0) return null

  // 规则 1：答案正文里显式引用本课另一 md（含题目文件时才认，避免引用图片/附件误判）。
  const body = markdownBodies.get(child.id)
  if (body !== undefined) {
    const referenced = new Set<string>()
    for (const reference of extractResourceReferences(body)) {
      const name = normalizeReferenceName(reference)
      for (const candidate of questionFiles) {
        if (candidate.originalName.toLocaleLowerCase('zh-CN') === name) referenced.add(candidate.id)
      }
    }
    if (referenced.size === 1) return [...referenced][0]
    if (referenced.size > 1) return null
  }

  // 规则 2：答案名去词干后的主干，恰好与本课一个非答案 md 主干互为包含。
  const stem = stripAnswerStem(child.originalName.replace(/\.[^.]+$/u, ''))
  if (Array.from(stem).length < ANSWER_STEM_MIN_CHARS) return null
  const matches = questionFiles.filter((candidate) => {
    const candidateStem = candidate.originalName.replace(/\.[^.]+$/u, '')
    return candidateStem.includes(stem) || stem.includes(candidateStem)
  })
  return matches.length === 1 ? matches[0].id : null
}

function stripAnswerStem(name: string): string {
  return name
    // 先去尾部括号组（如「（教师答案与全解全析）」），再剥裸词干（如「-答案」「 核对表」）。
    .replace(/[\s\-_（(]*[（(][^（()）]*(?:答案|解析|解答|核对|全解全析|详解|教师版)[^（()）]*[）)][\s\-_]*$/u, '')
    .replace(/[\s\-_（(]*(?:参考答案与解析|参考答案|答案与全解全析|全解全析|答案|解析|解答|核对表|教师版|详解)$/u, '')
    .replace(/[\s\-_（(]+$/u, '')
    .trim()
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
