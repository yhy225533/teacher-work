import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  buildCourseSummaries,
  lessonFeedbackStatus,
} from '../src/renderer/course-view-model'
import type { CoreOverview } from '../src/shared/core-contracts'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const confirmModal = source('../src/renderer/confirm-lesson-taught-modal.tsx')
const feedbackModal = source('../src/renderer/lesson-feedback-modal.tsx')
const feedbackSection = source('../src/renderer/lesson-feedback-section.tsx')
const courseDetail = source('../src/renderer/course-detail.tsx')
const viewModel = source('../src/renderer/course-view-model.ts')

describe('V18-B 确认已上内嵌反馈（一对一）', () => {
  it('confirm modal embeds the feedback section above Current Lesson (§5.3 structure)', () => {
    expect(confirmModal).toContain('LessonFeedbackSection')
    const feedbackAt = confirmModal.indexOf('<LessonFeedbackSection')
    const currentAt = confirmModal.indexOf('确认后的 Current Lesson')
    const actionsAt = confirmModal.indexOf('feedback-actions')
    expect(feedbackAt).toBeGreaterThan(-1)
    expect(currentAt).toBeGreaterThan(feedbackAt)
    expect(actionsAt).toBeGreaterThan(currentAt)
  })

  it('primary button gating: soft-required feedback before confirm (D39)', () => {
    // 主按钮 disabled 条件包含 canSave（≥1 名学生有内容），且仍保留原确认语义（保存后 confirm）
    expect(confirmModal).toContain('disabled={saving || !canSave}')
    expect(confirmModal).toContain('✓ 保存反馈并确认已上')
    expect(confirmModal).toContain('✓ 更新反馈并确认已上')
  })

  it('save orchestration: notes first, then confirmLessonTaught (D39/D40)', () => {
    const createAt = confirmModal.indexOf('core.createNote')
    const updateAt = confirmModal.indexOf('core.updateNote')
    const confirmAt = confirmModal.indexOf('core.confirmLessonTaught')
    expect(createAt).toBeGreaterThan(-1)
    expect(updateAt).toBeGreaterThan(-1)
    expect(confirmAt).toBeGreaterThan(createAt)
    expect(confirmAt).toBeGreaterThan(updateAt)
  })

  it('skip path: secondary button opens reason radios + red double-confirm (D39)', () => {
    expect(confirmModal).toContain('跳过反馈，只确认已上')
    expect(confirmModal).toContain('保持原反馈，只确认已上')
    expect(confirmModal).toContain('不写这条反馈吗？跳过后课次行会标「缺反馈」，可随时补写。')
    expect(confirmModal).toContain('本课是自习 / 考试 / 答疑，没有可写的教学内容')
    expect(confirmModal).toContain('我稍后再写（提醒我）')
    expect(confirmModal).toContain('仍然跳过，只确认已上')
    expect(confirmModal).toContain('返回写反馈')
  })

  it('upsert editing state: latest manual note prefilled, update instead of duplicate (D40)', () => {
    expect(confirmModal).toContain('const existing = entry.latestNote')
    expect(confirmModal).toContain('if (existing === null)')
    expect(confirmModal).toContain('noteId: existing.id')
    // 已有反馈时次按钮语义切换
    expect(confirmModal).toContain("hadAnyFeedback ? '保持原反馈，只确认已上' : '跳过反馈，只确认已上'")
  })

  it('occurredOn auto value: scheduled date derived locally, never hand-edited (D40)', () => {
    expect(confirmModal).toContain('occurredOn,')
    expect(feedbackSection).toContain('自动取排课日期')
    expect(confirmModal).not.toContain('input type="date"')
  })

  it('no-active-student fallback: pure confirm without note calls or skip button', () => {
    expect(confirmModal).toContain('当前没有在读学生，无法写课后反馈。')
    expect(confirmModal).toContain('{hasStudents ? (')
    expect(confirmModal).toContain("hasStudents && !skipOpen")
  })
})

describe('V18-B 反馈可见性与补写（D42）', () => {
  it('lesson row badges: 已反馈 green / 缺反馈 yellow only for taught lessons', () => {
    expect(courseDetail).toContain('feedback.complete')
    expect(courseDetail).toContain('<em>已反馈</em>')
    expect(courseDetail).toContain('<em className="is-missing">缺反馈</em>')
    expect(courseDetail).toContain("session?.taughtConfirmedAt != null && feedback.students.length > 0")
  })

  it('Viewed Lesson panel: yellow alert + 补写反馈 button when missing; summary line when complete', () => {
    expect(courseDetail).toContain('本课缺反馈 · 确认已上时跳过了课后反馈')
    expect(courseDetail).toContain('✍ 补写反馈')
    expect(courseDetail).toContain('feedback-summary-line')
    expect(courseDetail).toContain('已挂到')
    // 未上课次不显示反馈元素
    expect(courseDetail).toContain('if (!feedback.taught || feedback.students.length === 0) return null')
  })

  it('makeup modal reuses the feedback section without Current Lesson or confirm actions', () => {
    expect(feedbackModal).toContain('LessonFeedbackSection')
    // 无 Current Lesson 下拉（不含其选项构建器）、无确认编排、无跳过按钮
    expect(feedbackModal).not.toContain('listValidCurrentLessons')
    expect(feedbackModal).not.toContain('suggestConfirmedDecision')
    expect(feedbackModal).not.toContain('core.confirmLessonTaught')
    expect(feedbackModal).toContain('✓ 保存反馈')
    expect(feedbackModal).not.toContain('跳过反馈')
  })

  it('makeup modal entry wired from course detail', () => {
    expect(courseDetail).toContain('LessonFeedbackModal')
    expect(courseDetail).toContain('setFeedbackLessonId')
  })
})

describe('V18-B lessonFeedbackStatus 派生（§5.1）', () => {
  function overviewFixture(options: {
    readonly taught?: boolean
    readonly manualNotes?: number
    readonly deletedNotes?: number
    readonly kind?: 'manual' | 'manual_edit' | 'lecture'
    readonly activeStudents?: number
  }): CoreOverview {
    const activeStudents = options.activeStudents ?? 1
    const now = '2026-09-06T00:00:00.000Z'
    const students = Array.from({ length: activeStudents }, (_, index) => ({
      id: `student-${index + 1}`,
      name: `学生${index + 1}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }))
    const notes = [
      ...(options.kind === 'lecture'
        ? []
        : Array.from({ length: options.manualNotes ?? 0 }, (_, index) => ({
          id: `note-${index + 1}`,
          studentId: students[0]!.id,
          lessonId: 'lesson-1',
          bodyMd: `反馈 ${index + 1}`,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          occurredOn: '2026-07-29',
          ...(options.kind === undefined || options.kind === 'manual' ? {} : { noteKind: options.kind }),
        }))),
      ...(options.kind === 'lecture'
        ? [{
          id: 'note-draft',
          studentId: students[0]!.id,
          lessonId: 'lesson-1',
          bodyMd: '# 讲义草稿',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          noteKind: 'lecture' as const,
          draftStatus: 'draft' as const,
        }]
        : []),
      ...Array.from({ length: options.deletedNotes ?? 0 }, (_, index) => ({
        id: `note-deleted-${index + 1}`,
        studentId: students[0]!.id,
        lessonId: 'lesson-1',
        bodyMd: '已删除反馈',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      })),
    ]
    return {
      nodes: [
        { id: 'course-1', parentId: null, kind: 'course' as const, title: '一对一课程', courseMode: 'one_to_one' as const, sortOrder: 0, contentMd: '', createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'period-1', parentId: 'course-1', kind: 'period' as const, title: '阶段', courseMode: null, sortOrder: 0, contentMd: '', createdAt: now, updatedAt: now, deletedAt: null },
        { id: 'lesson-1', parentId: 'period-1', kind: 'lesson' as const, title: '第 1 课', courseMode: null, sortOrder: 0, contentMd: '', createdAt: now, updatedAt: now, deletedAt: null },
      ],
      students,
      courseStudentLinks: students.map((student) => ({
        courseId: 'course-1',
        studentId: student.id,
        createdAt: now,
        endedAt: null,
      })),
      notes,
      courseProgress: [{ courseId: 'course-1', activePeriodId: 'period-1', currentLessonId: 'lesson-1', endedAt: null, updatedAt: now }],
      lessonSessions: [{
        lessonId: 'lesson-1',
        scheduledAt: '2026-07-29T10:00:00.000Z',
        durationMinutes: null,
        taughtConfirmedAt: options.taught ? now : null,
        attendanceRecordedAt: null,
        presentCount: 0,
        leaveCount: 0,
        absentCount: 0,
        totalCount: 0,
      }],
    }
  }

  it('derives taught/complete/hasFeedback from overview notes and active students', () => {
    const summary = buildCourseSummaries(overviewFixture({ taught: true, manualNotes: 1 }))[0]!
    const status = lessonFeedbackStatus(overviewFixture({ taught: true, manualNotes: 1 }), summary, 'lesson-1')
    expect(status.taught).toBe(true)
    expect(status.complete).toBe(true)
    expect(status.students[0]!.hasFeedback).toBe(true)
    expect(status.students[0]!.latestNote!.bodyMd).toBe('反馈 1')
  })

  it('missing note means incomplete even when the lesson is taught', () => {
    const overview = overviewFixture({ taught: true, manualNotes: 0 })
    const summary = buildCourseSummaries(overview)[0]!
    const status = lessonFeedbackStatus(overview, summary, 'lesson-1')
    expect(status.taught).toBe(true)
    expect(status.complete).toBe(false)
  })

  it('deleted notes and draft-kind notes do not count as feedback', () => {
    for (const fixtureOptions of [
      { taught: true, deletedNotes: 2 },
      { taught: true, kind: 'lecture' as const },
      { taught: true, kind: 'manual_edit' as const },
    ]) {
      const overview = overviewFixture(fixtureOptions)
      const summary = buildCourseSummaries(overview)[0]!
      const status = lessonFeedbackStatus(overview, summary, 'lesson-1')
      expect(status.complete).toBe(false)
      expect(status.students[0]!.hasFeedback).toBe(false)
    }
  })

  it('class lessons need every active student to be complete; latest note wins for editing', () => {
    const overview = overviewFixture({ taught: true, activeStudents: 2 })
    const summary = buildCourseSummaries(overview)[0]!
    const missingOne = lessonFeedbackStatus(overview, summary, 'lesson-1')
    expect(missingOne.complete).toBe(false)

    const withBoth = lessonFeedbackStatus({
      ...overview,
      notes: [
        ...overview.notes,
        { id: 'note-s1', studentId: 'student-1', lessonId: 'lesson-1', bodyMd: '反馈一', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null, occurredOn: '2026-07-29' },
        { id: 'note-s2', studentId: 'student-2', lessonId: 'lesson-1', bodyMd: '反馈二', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', deletedAt: null, occurredOn: '2026-07-29' },
      ],
    }, summary, 'lesson-1')
    expect(withBoth.complete).toBe(true)
  })

  it('view model exports lessonFeedbackStatus next to course summaries', () => {
    expect(viewModel).toContain('export function lessonFeedbackStatus')
  })
})

describe('V18-B 共享反馈区组件', () => {
  it('uses FEEDBACK_BODY_MAX_CHARS as textarea maxLength', () => {
    expect(feedbackSection).toContain('maxLength={FEEDBACK_BODY_MAX_CHARS}')
  })

  it('one-to-one renders a single expanded editor; class renders collapsed rows', () => {
    expect(feedbackSection).toContain("summary.course.courseMode === 'class'")
    expect(feedbackSection).toContain('is-single')
  })
})
