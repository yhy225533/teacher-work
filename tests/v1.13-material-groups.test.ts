import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { LessonMaterialGroup, ManagedFileRecord } from '../src/shared/file-contracts'
import {
  groupLessonMaterialNodes,
  lessonMaterialGroupRole,
  splitLessonFilesByRole,
  type LessonMaterialTreeNode,
} from '../src/renderer/lesson-prep-context'
import { LessonMaterialTree } from '../src/renderer/lesson-material-reader'

function file(id: string, originalName: string, mimeType = 'text/markdown'): ManagedFileRecord {
  return {
    id,
    originalName,
    sizeBytes: 10,
    mimeType,
    originFileId: null,
    mtimeMs: 1,
    contentHash: null,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
    deletedAt: null,
  }
}

const emptyContext = (lessonTitle = ''): { lessonTitle: string; files: readonly ManagedFileRecord[]; markdownBodies: ReadonlyMap<string, string> } => ({
  lessonTitle,
  files: [],
  markdownBodies: new Map(),
})

describe('V1.13/D75 启发式分组规则表（首中即停）', () => {
  it('rule 1: D46 讲义命名（版本链/编辑版）优先归讲义', () => {
    expect(lessonMaterialGroupRole(file('1', '相似三角形模型 · 第 2 版.md'), emptyContext())).toBe('lecture')
    expect(lessonMaterialGroupRole(file('2', '课件（编辑版）.md'), emptyContext())).toBe('lecture')
  })

  it('rule 2: 习题作业关键词 → exercise，且先于讲义关键词与标题匹配', () => {
    expect(lessonMaterialGroupRole(file('1', '习题.md'), emptyContext())).toBe('exercise')
    expect(lessonMaterialGroupRole(file('2', '题目.md'), emptyContext())).toBe('exercise')
    // 产品数据钉测：stem 含课次标题且含"作业" → 作业优先
    expect(lessonMaterialGroupRole(file('3', 'AMC8 余数 - 作业.md'), emptyContext('AMC8 余数'))).toBe('exercise')
    expect(lessonMaterialGroupRole(file('4', 'AMC8数论真题-答案.md'), emptyContext())).toBe('exercise')
    expect(lessonMaterialGroupRole(file('5', '填选练习.md'), emptyContext())).toBe('exercise')
  })

  it('rule 3: 试卷复习关键词 → exam', () => {
    expect(lessonMaterialGroupRole(file('1', '试卷-20260717182219-oev8cic.pdf', 'application/pdf'), emptyContext())).toBe('exam')
    expect(lessonMaterialGroupRole(file('2', '期中复习.md'), emptyContext())).toBe('exam')
    expect(lessonMaterialGroupRole(file('3', '选填专项.md'), emptyContext())).toBe('exam')
    expect(lessonMaterialGroupRole(file('4', '三角形复习.md'), emptyContext())).toBe('exam')
  })

  it('rule 4: 讲义类关键词（含补充讲义裁决）→ lecture；docx 讲义本体命中', () => {
    // 产品负责人裁决：补充讲义 = 讲义+习题一体系统 → 讲义
    expect(lessonMaterialGroupRole(file('1', '数论补充材料 - 奇偶性、连续整数与周期.md'), emptyContext())).toBe('lecture')
    expect(lessonMaterialGroupRole(file('2', '盐水浓度补充材料.md'), emptyContext())).toBe('lecture')
    expect(lessonMaterialGroupRole(file('3', 'AMC8 余数 - 例题.md'), emptyContext())).toBe('lecture')
    // 思源薄壳 + assets docx 讲义本体（文件名含"学生讲义"）
    expect(lessonMaterialGroupRole(
      file('4', '一线三等角与K字模型专题精讲与核心4题_学生讲义-20260906020746-fbtvwbb.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      emptyContext('综合几何'),
    )).toBe('lecture')
    expect(lessonMaterialGroupRole(file('5', '一线三等角与K字模型专题精讲.md'), emptyContext('综合几何'))).toBe('lecture')
    expect(lessonMaterialGroupRole(file('6', '教师版.md'), emptyContext())).toBe('lecture')
  })

  it('rule 5: 文件名主干与课次标题互相包含（≥2 字符）→ lecture', () => {
    expect(lessonMaterialGroupRole(file('1', '相似三角形模型.md'), emptyContext('相似三角形模型'))).toBe('lecture')
    expect(lessonMaterialGroupRole(file('2', '二次函数综合题.md'), emptyContext('二次函数综合题 第2课时'))).toBe('lecture')
    // 单字符标题不参与包含判断
    expect(lessonMaterialGroupRole(file('3', '习题.md'), emptyContext('题'))).toBe('exercise')
  })

  it('rule 6: md 正文引用非图片本地文件（薄壳外链容器）→ lecture；纯图片引用不算', () => {
    const shell = file('shell', '课堂随记.md')
    const docx = file('docx', '讲义本体-20260906020746-fbtvwbb.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const image = file('img', 'image-20260719-usjo239.png', 'image/png')
    // 薄壳 md：[讲义](assets/xxx.docx) → lecture
    expect(lessonMaterialGroupRole(shell, {
      lessonTitle: '',
      files: [shell, docx],
      markdownBodies: new Map([['shell', '# 课题\n\n[讲义本体.docx](assets/讲义本体-20260906020746-fbtvwbb.docx)']]),
    })).toBe('lecture')
    // 无关键词文件名 + 仅 ![](assets/xxx.png) 题图引用 → 不触发薄壳规则，兜底 misc
    const notesMd = file('ex', '课堂记录.md')
    expect(lessonMaterialGroupRole(notesMd, {
      lessonTitle: '',
      files: [notesMd, image],
      markdownBodies: new Map([['ex', '# 记录\n\n![](assets/image-20260719-usjo239.png)']]),
    })).toBe('misc')
  })

  it('rule 7: 兜底 misc（英语词汇/课本定义/未命名）', () => {
    expect(lessonMaterialGroupRole(file('1', '英语词汇.md'), emptyContext())).toBe('misc')
    expect(lessonMaterialGroupRole(file('2', '课本定义／定理.md'), emptyContext())).toBe('misc')
    expect(lessonMaterialGroupRole(file('3', '未命名.md'), emptyContext())).toBe('misc')
  })
})

describe('V1.13/D76 四组桶与语义演进', () => {
  it('groupLessonMaterialNodes buckets tree nodes in group order', () => {
    const nodes: LessonMaterialTreeNode[] = [
      { file: file('a', '第2讲 相似三角形模型 · 第 1 版.md'), children: [] },
      { file: file('b', '习题.md'), children: [] },
      { file: file('c', '期中复习.md'), children: [] },
      { file: file('d', '英语词汇.md'), children: [] },
    ]
    const buckets = groupLessonMaterialNodes(nodes, (node) => lessonMaterialGroupRole(node, emptyContext()))
    expect(buckets.lecture.map((node) => node.file.id)).toEqual(['a'])
    expect(buckets.exercise.map((node) => node.file.id)).toEqual(['b'])
    expect(buckets.exam.map((node) => node.file.id)).toEqual(['c'])
    expect(buckets.misc.map((node) => node.file.id)).toEqual(['d'])
  })

  it('splitLessonFilesByRole semantic evolution: imported handout mds count as lecture for hero chips', () => {
    const files = [
      file('a', '第2讲 相似三角形模型 · 第 1 版.md'),
      file('b', '数论补充材料.md'),
      file('c', '习题.md'),
      file('d', '英语词汇.md'),
    ]
    const { lecture, materials } = splitLessonFilesByRole(files)
    expect(lecture.map((node) => node.id)).toEqual(['a', 'b'])
    expect(materials.map((node) => node.id)).toEqual(['c', 'd'])
  })
})

describe('V1.13/D76 LessonMaterialTree 四组渲染与改组菜单', () => {
  const files = [
    file('a', '数论补充材料.md'),
    file('b', '习题.md'),
    file('c', '第2讲 · 第 1 版.md'),
    file('d', '英语词汇.md'),
  ]
  const overrides = new Map<string, LessonMaterialGroup>([['d', 'exam']])

  function renderTree(): string {
    return renderToStaticMarkup(createElement(LessonMaterialTree, {
      files,
      selectedFileId: '',
      onSelectFile: () => undefined,
      grouped: true,
      grouping: { lessonTitle: '', groupOverrides: overrides },
      onSetFileGroup: () => undefined,
    }))
  }

  it('renders the four groups in order with counts and manual-override placement', () => {
    const markup = renderTree()
    const lectureIndex = markup.indexOf('本课讲义')
    const exerciseIndex = markup.indexOf('习题与作业')
    const examIndex = markup.indexOf('试卷与复习')
    const miscIndex = markup.indexOf('其他资料')
    expect(lectureIndex).toBeGreaterThan(-1)
    expect(exerciseIndex).toBeGreaterThan(lectureIndex)
    expect(examIndex).toBeGreaterThan(exerciseIndex)
    expect(miscIndex).toBeGreaterThan(examIndex)
    // 手动覆盖：英语词汇（启发式 misc）被移入试卷组
    const examSlice = markup.slice(examIndex)
    expect(examSlice.indexOf('英语词汇')).toBeGreaterThan(-1)
    // misc 组空态（0 项）
    expect(markup.slice(miscIndex)).toContain('本课还没有其他资料。')
  })

  it('renders per-row regroup menus for non-lecture files only', () => {
    const markup = renderTree()
    expect(markup).toContain('tree-group-menu-btn')
    expect(markup).toContain('移动到分组')
    // 版本链讲义文件（isLessonLectureFile）所在行无菜单触发按钮
    const at = markup.indexOf('第2讲 · 第 1 版')
    expect(at).toBeGreaterThan(-1)
    expect(markup.slice(at, at + 260)).not.toContain('app-menu')
  })

  it('menu entries include auto-restore pinned at source level (interaction state not statically renderable)', () => {
    const readerSource = readFileSync(join(__dirname, '..', 'src/renderer/lesson-material-reader.tsx'), 'utf8')
    expect(readerSource).toContain('↺ 恢复自动分组')
    expect(readerSource).toContain('disabled: !hasGroupOverride')
    expect(readerSource).toContain('disabled: currentGroupRole === group')
  })

  it('group menu is hidden when onSetFileGroup is not provided (readonly/pick overlays)', () => {
    const markup = renderToStaticMarkup(createElement(LessonMaterialTree, {
      files,
      selectedFileId: '',
      onSelectFile: () => undefined,
      grouped: true,
    }))
    expect(markup).not.toContain('移动到分组')
    expect(markup).not.toContain('tree-group-menu-btn')
  })
})
