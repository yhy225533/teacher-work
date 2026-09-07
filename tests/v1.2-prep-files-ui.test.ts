import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('V12-04 lesson files and prep renderer contract', () => {
  it('renders only Viewed Lesson links and has an explicit no-selection state', () => {
    const detail = source('../src/renderer/course-detail.tsx')
    const files = source('../src/renderer/lesson-files-section.tsx')
    expect(detail).toContain('<LessonFilesSection')
    expect(detail).toContain('lesson={viewedLesson}')
    expect(files).toContain('listLessonPrepFiles(overview, lesson.id)')
    expect(files).toContain('请先选择一个课次查看资料。')
    expect(files).toContain('不包含整门课程资料或学生文件')
    expect(files).not.toContain('targetType === \'student\'')
  })

  it('continues the latest Viewed Lesson draft without changing course progress', () => {
    const dashboard = source('../src/renderer/course-dashboard.tsx')
    const detail = source('../src/renderer/course-detail.tsx')
    const files = source('../src/renderer/lesson-files-section.tsx')
    expect(dashboard).toContain('onOpenDraft={onOpenDraft}')
    expect(detail).toContain('latestLessonDraft(overview, viewedLesson.id)')
    expect(detail).toContain("viewedDraft === null ? '开始备课' : '继续备课'")
    expect(files).toContain('✦ 修改这份')
    // V19-B（D57）：整课重做按钮收进 ⋯ 菜单（lesson 范围 intent 不变）
    expect(files).toContain("label: '整个课件包重做'")
    expect(files).toContain('onSelect: rebuildLesson')
    expect(files).toContain('AI 新建备课')
    expect(files).toContain('继续上次修改')
    expect(files).not.toContain('setCurrentLesson')
    expect(files).not.toContain('startPeriod')
    expect(files).not.toContain('confirmLessonTaught')
  })

  it('names the immutable Prep Lesson consistently and removes student file targets from the UI', () => {
    const draft = source('../src/renderer/draft-panel.tsx')
    const managed = source('../src/renderer/managed-files-panel.tsx')
    const service = source('../src/main/files/managed-file-service.ts')
    // V19-A（D55）：补充参考行迁入对话栏依据区（radio + chips + 三入口）
    expect(draft).toContain('补充参考（AI 只用来理解要求）')
    expect(draft).toContain('自动挂当前讲义，AI 只改这份，未提及部分保持不变')
    expect(draft).toContain('保存到本次课次')
    expect(draft).toContain('lessonId: context.lessonId')
    expect(managed).not.toContain('copyToStudent')
    expect(managed).not.toContain('学生附件')
    expect(service).toContain('copyToStudent(fileId: string, studentId: string)')
    expect(service).toContain("targetType: 'student'")
  })
})
