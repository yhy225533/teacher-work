import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { NodeRecord, StudentRecord } from '../src/shared/core-contracts'
import type { ManagedFileOverview, ManagedFileRecord } from '../src/shared/file-contracts'
import {
  buildLessonMaterialTree,
  classifyLessonCoursewareFiles,
  createLessonPrepContext,
  filterLessonMaterialFiles,
  isSelectableLessonPrepFile,
  lectureChainBaseName,
  lessonFileBadgeLabel,
  lessonFileSourceLabel,
  listLessonPrepFiles,
  orderAiEditableFiles,
  reconcileSelectedLessonFileIds,
  splitLessonFilesByRole,
} from '../src/renderer/lesson-prep-context'

function node(
  id: string,
  kind: NodeRecord['kind'],
  title: string,
  courseMode: NodeRecord['courseMode'] = null,
): NodeRecord {
  return {
    id,
    parentId: null,
    kind,
    title,
    courseMode,
    sortOrder: 0,
    contentMd: '',
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    deletedAt: null,
  }
}

function student(id: string, name: string): StudentRecord {
  return {
    id,
    name,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    deletedAt: null,
  }
}

function file(id: string, name: string, mimeType = 'text/plain'): ManagedFileRecord {
  return {
    id,
    originalName: name,
    sizeBytes: 10,
    mimeType,
    originFileId: null,
    mtimeMs: 1,
    contentHash: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
    deletedAt: null,
  }
}

describe('V11-02 lesson prep renderer state', () => {
  it('carries an associated student for one-to-one but never requires one for a class', () => {
    const lesson = node('lesson-1', 'lesson', '圆的面积')
    const linkedStudent = student('student-1', '张同学')

    expect(createLessonPrepContext(
      node('course-1', 'course', '一对一数学', 'one_to_one'),
      lesson,
      [linkedStudent],
    )).toMatchObject({
      lessonId: lesson.id,
      studentId: linkedStudent.id,
      studentNames: ['张同学'],
    })
    expect(createLessonPrepContext(
      node('course-2', 'course', '六年级班课', 'class'),
      lesson,
      [],
    )).toEqual(expect.not.objectContaining({ studentId: expect.anything() }))
  })

  it('lists only persistent lesson copies and selects newly added files by default', () => {
    const externalCopy = file('external-copy', '外部讲义.md')
    const materialCopy = file('material-copy', '素材练习.pdf')
    const imageCopy = file('image-copy', '讲义图片.png', 'image/png')
    const unrelated = file('other-file', '其他课次.docx')
    const overview: ManagedFileOverview = {
      files: [externalCopy, materialCopy, imageCopy, unrelated],
      links: [
        { fileId: externalCopy.id, targetType: 'lesson', targetId: 'lesson-1', createdAt: '1' },
        { fileId: materialCopy.id, targetType: 'lesson', targetId: 'lesson-1', createdAt: '2' },
        { fileId: imageCopy.id, targetType: 'lesson', targetId: 'lesson-1', createdAt: '3' },
        { fileId: unrelated.id, targetType: 'lesson', targetId: 'lesson-2', createdAt: '4' },
      ],
    }

    const lessonFiles = listLessonPrepFiles(overview, 'lesson-1')
    expect(lessonFiles.map((item) => item.id)).toEqual([externalCopy.id, materialCopy.id, imageCopy.id])
    expect(reconcileSelectedLessonFileIds([], new Set(), lessonFiles)).toEqual([
      externalCopy.id,
      materialCopy.id,
    ])
    expect(reconcileSelectedLessonFileIds(
      [externalCopy.id],
      new Set([externalCopy.id]),
      lessonFiles,
    )).toEqual([externalCopy.id, materialCopy.id])
  })

  it('keeps markdown files flat and nests referenced assets below their document', () => {
    const lecture = file('lecture', '三角形基础.md', 'text/markdown')
    const definition = file('definition', '课本定义.md', 'text/markdown')
    const lectureImage = file('lecture-image', 'triangle.png', 'image/png')
    const duplicateLectureImage = file('lecture-image-copy', 'triangle.png', 'image/png')
    const definitionImage = file('definition-image', 'definition.png', 'image/png')
    const orphanImage = file('orphan-image', '未引用.png', 'image/png')

    const tree = buildLessonMaterialTree(
      [lecture, definition, lectureImage, duplicateLectureImage, definitionImage, orphanImage],
      new Map([
        [lecture.id, '![图](assets/triangle.png)'],
        [definition.id, '![共享图](assets/triangle.png)\n![图](assets/definition.png)'],
      ]),
    )

    expect(tree.map((node) => node.file.id)).toEqual([
      lecture.id,
      definition.id,
      orphanImage.id,
    ])
    expect(tree.find((node) => node.file.id === lecture.id)?.children.map((child) => child.id)).toEqual([
      lectureImage.id,
      duplicateLectureImage.id,
    ])
    expect(tree.find((node) => node.file.id === definition.id)?.children.map((child) => child.id)).toEqual([
      lectureImage.id,
      duplicateLectureImage.id,
      definitionImage.id,
    ])
    expect(isSelectableLessonPrepFile(lectureImage)).toBe(false)
    expect(isSelectableLessonPrepFile(lecture)).toBe(true)
  })

  it('nests line-wrapped SiYuan image references below their Markdown document', () => {
    const lecture = file('lecture', '三角形基础.md', 'text/markdown')
    const lectureImage = file('lecture-image', 'figure.webp', 'image/webp')

    const tree = buildLessonMaterialTree(
      [lecture, lectureImage],
      new Map([[lecture.id, '!\n[图](assets/figure\n.webp)']]),
    )

    expect(tree).toHaveLength(1)
    expect(tree[0]?.file.id).toBe(lecture.id)
    expect(tree[0]?.children.map((child) => child.id)).toEqual([lectureImage.id])
  })

  it('hides exported folder index markdown while keeping real lesson documents and feedback', () => {
    const stageIndex = file('stage', '七年级春季.md', 'text/markdown')
    const lessonIndex = file('lesson-index', '第二课.md', 'text/markdown')
    const lecture = file('lecture', '三角形基础.md', 'text/markdown')
    const feedback = file('feedback', '课后反馈.md', 'text/markdown')

    expect(filterLessonMaterialFiles(
      [stageIndex, lessonIndex, lecture, feedback],
      { periodTitle: '七年级春季', lessonLabel: '第二课' },
    ).map((item) => item.id)).toEqual([lecture.id, feedback.id])
  })

  it('keeps real topic-titled lectures while hiding bare numbered indexes (V152-E)', () => {
    const bareIndex = file('bare', '第12讲.md', 'text/markdown')
    const bareCourseIndex = file('bare-course', '第3课.md', 'text/markdown')
    const realLecture = file('real-lecture', '第1讲 实数综合.md', 'text/markdown')
    const anotherReal = file('real-2', '第5讲 二次根式综合.md', 'text/markdown')

    expect(filterLessonMaterialFiles(
      [bareIndex, bareCourseIndex, realLecture, anotherReal],
      { periodTitle: '七升八暑假', lessonLabel: '第 1 讲' },
    ).map((item) => item.id)).toEqual([realLecture.id, anotherReal.id])
  })

  it('classifies the latest published lesson version without mixing history into current materials (V1531-A)', () => {
    const sourceLecture = file('source', '三角形基础.md', 'text/markdown')
    const firstVersion = file('v1', '三角形基础 · 第 1 版.md', 'text/markdown')
    const latestVersion = file('v2', '三角形基础 · 第 2 版.md', 'text/markdown')
    const image = file('image', 'triangle.png', 'image/png')

    const classified = classifyLessonCoursewareFiles([sourceLecture, firstVersion, image, latestVersion])

    expect(classified.currentVersion?.id).toBe(latestVersion.id)
    expect(classified.history.map((item) => item.id)).toEqual([firstVersion.id])
    expect(classified.currentMaterials.map((item) => item.id)).toEqual([
      latestVersion.id,
      sourceLecture.id,
      image.id,
    ])
  })
})

describe('V1.7.2 lesson file source label', () => {
  it('labels external-library and material-library copies and skips app-generated names', () => {
    expect(lessonFileSourceLabel(file('ext-1', '二次根式加减法.md', 'text/markdown'))).toBe('外部资料')
    expect(lessonFileSourceLabel(file('ext-2', '期中试卷.docx'))).toBe('外部资料')
    expect(lessonFileSourceLabel({ ...file('mat-1', '因式分解速记.md', 'text/markdown'), originFileId: 'material-source' })).toBe('素材库')

    // 工作台产物按命名排除：AI 版本链（含学生版）与人工编辑版不标来源
    expect(lessonFileSourceLabel(file('pub-1', '有理数 · 第 1 版.md', 'text/markdown'))).toBe(null)
    expect(lessonFileSourceLabel(file('pub-2', '有理数 · 第 2 版 · 学生版.md', 'text/markdown'))).toBe(null)
    expect(lessonFileSourceLabel(file('edit-1', '二次根式加减法（编辑版）.md', 'text/markdown'))).toBe(null)
  })
})

describe('V1.8.1/D46 splitLessonFilesByRole 课件区讲义/材料分组', () => {
  it('sends version-chain, student-edition and manual-edit copies to lecture; everything else to materials', () => {
    const versioned = file('v1', '暑假综合复习 · 第 1 版.md', 'text/markdown')
    const studentEdition = file('v2', '暑假综合复习 · 第 2 版 · 学生版.md', 'text/markdown')
    const edited = file('e1', '二次根式（编辑版）.md', 'text/markdown')
    const externalMd = file('ext-1', '题目.md', 'text/markdown')
    const answerMd = file('ext-2', '学生答案核对表.md', 'text/markdown')
    const docx = file('ext-3', '第1章 有理数专练.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const image = file('img-1', 'q015-20260812.png', 'image/png')

    const byRole = splitLessonFilesByRole([versioned, externalMd, studentEdition, docx, edited, answerMd, image])

    expect(byRole.lecture.map((item) => item.id)).toEqual([versioned.id, studentEdition.id, edited.id])
    expect(byRole.materials.map((item) => item.id)).toEqual([externalMd.id, docx.id, answerMd.id, image.id])
  })

  it('keeps original relative order inside each group and tolerates an empty lecture group', () => {
    const externalMd = file('ext-1', '题目.md', 'text/markdown')
    const image = file('img-1', 'figure.png', 'image/png')
    const byRole = splitLessonFilesByRole([image, externalMd])
    expect(byRole.lecture).toEqual([])
    expect(byRole.materials.map((item) => item.id)).toEqual([image.id, externalMd.id])
  })

  it('never classifies a same-name non-markdown file as lecture (mime must be text/markdown)', () => {
    const fakeVersionedDocx = file('x1', '复习 · 第 1 版.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const byRole = splitLessonFilesByRole([fakeVersionedDocx])
    expect(byRole.lecture).toEqual([])
    expect(byRole.materials.map((item) => item.id)).toEqual([fakeVersionedDocx.id])
  })
})

describe('V1.14/D86 classify 版本链按基名分链', () => {
  it('shows only chain heads in currentMaterials and groups history per chain (multi-chain fix)', () => {
    // 双链场景（V1.14 新建讲义起自定义名）：旧实现会把「复习讲义 · 第 1 版」误吞进历史
    const mainV2 = file('main-2', '二次根式 · 第 2 版.md', 'text/markdown')
    const mainV1 = file('main-1', '二次根式 · 第 1 版.md', 'text/markdown')
    const otherV1 = file('other-1', '复习讲义 · 第 1 版.md', 'text/markdown')
    const image = file('img', 'figure.png', 'image/png')
    // 复习讲义链头最近创建 → 主讲义
    const classified = classifyLessonCoursewareFiles([
      { ...mainV2, createdAt: '2026-01-02T00:00:00.000Z' },
      { ...mainV1, createdAt: '2026-01-01T00:00:00.000Z' },
      { ...otherV1, createdAt: '2026-01-03T00:00:00.000Z' },
      image,
    ])

    // 主讲义 = 最近保存的链头（createdAt 最新），与版本号大小无关
    expect(classified.currentVersion?.id).toBe(otherV1.id)
    // 两条链头都在树里（currentMaterials），旧版只在 history
    expect(classified.lectureChainHeads.has(otherV1.id)).toBe(true)
    expect(classified.lectureChainHeads.has(mainV2.id)).toBe(true)
    expect(classified.history.map((item) => item.id)).toEqual([mainV1.id])
    expect(classified.currentMaterials.map((item) => item.id)).toEqual([
      otherV1.id,
      mainV2.id,
      image.id,
    ])
  })

  it('single chain keeps legacy semantics: highest version is head, older versions in history', () => {
    const sourceMd = file('src', '三角形基础.md', 'text/markdown')
    const v1 = file('v1', '三角形基础 · 第 1 版.md', 'text/markdown')
    const v2 = file('v2', '三角形基础 · 第 2 版.md', 'text/markdown')
    const image = file('image', 'triangle.png', 'image/png')

    const classified = classifyLessonCoursewareFiles([sourceMd, v1, image, v2])

    expect(classified.currentVersion?.id).toBe(v2.id)
    expect(classified.history.map((item) => item.id)).toEqual([v1.id])
    expect(classified.currentMaterials.map((item) => item.id)).toEqual([v2.id, sourceMd.id, image.id])
  })

  it('lectureChainBaseName extracts the base and leaves non-chain names null', () => {
    expect(lectureChainBaseName('二次根式 · 第 3 版.md')).toBe('二次根式')
    expect(lectureChainBaseName('复习 · 第 12 版 · 学生版.md')).toBe(null)
    expect(lectureChainBaseName('题目.md')).toBe(null)
  })

  it('lessonFileBadgeLabel hides the default 外部资料 badge and keeps 素材库', () => {
    expect(lessonFileBadgeLabel(file('ext-1', '题目.md', 'text/markdown'))).toBe(null)
    expect(lessonFileBadgeLabel({ ...file('mat-1', '速记.md', 'text/markdown'), originFileId: 'material-source' })).toBe('素材库')
    expect(lessonFileBadgeLabel(file('pub-1', '有理数 · 第 1 版.md', 'text/markdown'))).toBe(null)
  })

  it('orderAiEditableFiles keeps chains adjacent with heads first (D86: 链间按链头 createdAt，与主讲义语义一致)', () => {
    // 链A「复习讲义」只有第 1 版但最近创建（主讲义）；链B「二次根式」第 2 版较早创建。
    // 旧实现按全课版本号排序会把「二次根式 · 第 2 版」排到主讲义链头之前。
    const mainV2 = { ...file('main-2', '二次根式 · 第 2 版.md', 'text/markdown'), createdAt: '2026-01-02T00:00:00.000Z' }
    const mainV1 = { ...file('main-1', '二次根式 · 第 1 版.md', 'text/markdown'), createdAt: '2026-01-01T00:00:00.000Z' }
    const otherV1 = { ...file('other-1', '复习讲义 · 第 1 版.md', 'text/markdown'), createdAt: '2026-01-03T00:00:00.000Z' }
    const external = file('ext', '思源导出讲义.md', 'text/markdown')
    const ordered = orderAiEditableFiles([mainV1, external, otherV1, mainV2])
    expect(ordered.map((item) => item.originalName)).toEqual([
      '复习讲义 · 第 1 版.md',
      '二次根式 · 第 2 版.md',
      '二次根式 · 第 1 版.md',
      '思源导出讲义.md',
    ])
  })
})

describe('V1.14/D83+D87 课件区源码结构（新建入口 + 工具行重排 + 历史按需）', () => {
  const section = readFileSync(join(__dirname, '..', 'src', 'renderer', 'lesson-files-section.tsx'), 'utf8')
  const reader = readFileSync(join(__dirname, '..', 'src', 'renderer', 'lesson-material-reader.tsx'), 'utf8')
  const styles = readFileSync(join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf8')

  it('wires the create-lecture-doc flow: requestText default name → createLessonDoc → select + editing', () => {
    expect(section).toContain('async function createLectureDoc')
    expect(section).toContain('requestText({')
    expect(section).toContain("initialValue: lesson.title")
    expect(section).toContain('files.createLessonDoc({ lessonId: lesson.id, name })')
    // D83 修订：setSelectedFileId 与 setEditing 同批会被「切文件退出编辑」effect 反清——
    // 改 enterEditingRef 进入编辑意图，选中变化 effect 消费后置 editing=true。
    expect(section).toContain('enterEditingRef.current = true')
    expect(section).toContain('setSelectedFileId(created.file.id)')
    expect(section).toContain('enterEditingRef.current = false')
    expect(section).toContain('await reloadCore()')
  })

  it('exposes both entries: ⋯ menu first item and lecture group header ＋ (readOnly excluded)', () => {
    expect(section).toContain("kind: 'item', key: 'create-lecture-doc', label: '＋ 新建讲义'")
    expect(section).toContain('onAddLectureDoc={!readOnly ? createLectureDoc : undefined}')
    expect(reader).toContain('readonly onAddLectureDoc?: () => void')
    expect(reader).toContain("className=\"group-add-btn\"")
    expect(reader).toContain("title=\"新建讲义（创建后直接进入编辑）\"")
    expect(styles).toContain('.material-role-group-title .group-add-btn')
  })

  it('history on demand: no resident block, ⋯ per-chain entry, auto collapse on file switch', () => {
    expect(section).toContain('const [historyOpenFileId, setHistoryOpenFileId] = useState<string | null>(null)')
    expect(section).toContain('setHistoryOpenFileId(null) }, [selectedFileId]')
    expect(section).toContain('setHistoryOpenFileId(selectedFile.id)')
    expect(section).toContain('selectedChainHistory.length > 0')
    // 旧常驻块 summary 退役
    expect(section).not.toContain('点开可系统打开查看，旧版永不丢失')
  })

  it('toolbar order: three primary actions before the ⛶ immersive icon (D87)', () => {
    // 断言范围 = hasAnyMarkdown 分支（三主键 + ⛶ + ⋯ 同排；无 md 分支为 引导+AI 主键+⛶）
    const mdBranchAt = section.indexOf('!readOnly && hasAnyMarkdown && (')
    const actionsBlock = section.slice(mdBranchAt, section.indexOf('</header>', mdBranchAt))
    const modifyAt = actionsBlock.indexOf('✦ 修改这份')
    const editAt = actionsBlock.indexOf('✎ 编辑')
    const exportAt = actionsBlock.indexOf('⬇ 导出 PDF')
    const immersiveAt = actionsBlock.indexOf('{immersiveButton}')
    expect(modifyAt).toBeGreaterThan(-1)
    expect(editAt).toBeGreaterThan(modifyAt)
    expect(exportAt).toBeGreaterThan(editAt)
    // ⛶ 图标在 ⋯ 菜单之前、三主键之后（行尾位）
    expect(immersiveAt).toBeGreaterThan(exportAt)
    const menuAt = actionsBlock.indexOf('AppMenuButton')
    expect(menuAt).toBeGreaterThan(immersiveAt)
    expect(styles).toContain('.lesson-files-toolbar-actions .toolbar-icon-btn')
  })

  it('tree head dedup: empty treeTitle renders no title, files-section passes empty string', () => {
    expect(section).toContain('treeTitle=""')
    expect(reader).toContain("{treeTitle !== '' && (")
  })
})
