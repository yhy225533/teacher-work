import { useMemo, useState } from 'react'

import type { CoreOverview, NodeRecord } from '../shared/core-contracts'
import { FEEDBACK_BODY_MAX_CHARS } from '../shared/feedback-contracts'
import { lessonFeedbackStatus, type CourseSummary, type LessonFeedbackStatus } from './course-view-model'

/**
 * D39/D40：确认已上与补写弹窗共用的课后反馈区（受控组件——宿主持有 bodies 并负责保存编排）。
 * 一对一 = 单学生直接编辑；班课 = 在读学生折叠列表（V18-C 接到点名徽标与逐学生 gating）。
 */
export default function LessonFeedbackSection({
  overview,
  summary,
  lesson,
  bodies,
  onBodiesChange,
}: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary
  readonly lesson: NodeRecord
  readonly bodies: Readonly<Record<string, string>>
  readonly onBodiesChange: (bodies: Readonly<Record<string, string>>) => void
}): React.JSX.Element {
  const feedback = useMemo(
    () => lessonFeedbackStatus(overview, summary, lesson.id),
    [lesson.id, overview, summary],
  )
  const isClass = summary.course.courseMode === 'class'
  const scheduledAt = overview.lessonSessions
    .find((session) => session.lessonId === lesson.id)?.scheduledAt
  const feedbackDate = useMemo(() => {
    const anchor = scheduledAt == null ? new Date() : new Date(scheduledAt)
    const pad = (part: number): string => part.toString().padStart(2, '0')
    return `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`
  }, [scheduledAt])
  const writtenCount = feedback.students
    .filter((entry) => (bodies[entry.student.id] ?? '').trim() !== '').length

  return (
    <section className="feedback-section">
      <header className="feedback-section-head">
        <b>课后反馈</b>
        <span className="feedback-badge-required">本课常规项</span>
        <span className="feedback-section-hint">保存后自动挂到学生名下，学生页可见</span>
      </header>
      {feedback.students.length === 0 ? (
        <p className="feedback-empty">当前没有在读学生，无法写课后反馈。</p>
      ) : (
        <>
          <div className="feedback-meta">
            <span className="feedback-meta-who">
              {feedback.students.length === 1
                ? `👤 ${feedback.students[0]!.student.name}`
                : `👤 在读学生 ${feedback.students.length} 人`}
            </span>
            <span className="feedback-meta-date">📅 反馈日期 <b>{feedbackDate}</b> <i>自动取排课日期</i></span>
          </div>
          {isClass && (
            <p className="feedback-class-count">{writtenCount} / {feedback.students.length} 已写</p>
          )}
          <div className={isClass ? 'student-fb-list' : 'student-fb-list is-single'}>
            {feedback.students.map((entry) => (
              <FeedbackStudentRow
                key={entry.student.id}
                entry={entry}
                isClass={isClass}
                body={bodies[entry.student.id] ?? ''}
                onBodyChange={(value) => onBodiesChange({ ...bodies, [entry.student.id]: value })}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function FeedbackStudentRow({
  entry,
  isClass,
  body,
  onBodyChange,
}: {
  readonly entry: LessonFeedbackStatus['students'][number]
  readonly isClass: boolean
  readonly body: string
  readonly onBodyChange: (value: string) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(!isClass)
  const written = body.trim() !== ''
  return (
    <div className={`student-fb-row${!written && isClass ? ' is-missing' : ''}`}>
      {isClass && (
        <button
          className="student-fb-head"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="caret" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <b>{entry.student.name}</b>
          {entry.hasFeedback && <i className="att-chip existing">已有反馈</i>}
          <span className={`st${written ? ' done' : ' missing'}`}>{written ? '已写 ✓' : '待写'}</span>
        </button>
      )}
      {(expanded || !isClass) && (
        <div className="student-fb-body">
          <textarea
            value={body}
            maxLength={FEEDBACK_BODY_MAX_CHARS}
            placeholder="写本课的课后反馈：课堂内容 / 掌握情况 / 作业与下节安排…"
            onChange={(event) => onBodyChange(event.target.value)}
          />
          {isClass && entry.hasFeedback && (
            <p className="student-fb-existing">已有反馈将按修改后的内容更新（不会重复建第二条）。</p>
          )}
        </div>
      )}
    </div>
  )
}
