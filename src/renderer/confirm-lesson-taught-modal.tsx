import { useEffect, useMemo, useState } from 'react'

import type { CoreOverview, CurrentLessonDecision, NodeRecord } from '../shared/core-contracts'
import {
  getLessonNumber,
  lessonFeedbackStatus,
  listValidCurrentLessons,
  suggestConfirmedDecision,
  type CourseSummary,
} from './course-view-model'
import LessonFeedbackSection from './lesson-feedback-section'
import Modal from './modal'
import { toErrorMessage } from './ui-utils'

/**
 * D39：确认已上弹窗内嵌课后反馈区（软强制）。
 * 主按钮「保存反馈并确认已上」= 先逐学生 upsert note（D40 幂等）再 confirmLessonTaught；
 * 跳过为次按钮，展开原因单选 + 红色二次确认；保存与确认任一步失败停在弹窗内可重试。
 */
export default function ConfirmLessonTaughtModal({
  overview,
  summary,
  lesson,
  onClose,
  onSaved,
}: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary
  readonly lesson: NodeRecord
  readonly onClose: () => void
  readonly onSaved: (message: string) => Promise<void>
}): React.JSX.Element {
  const initialDecision = useMemo(
    () => suggestConfirmedDecision(overview, summary, lesson.id),
    [lesson.id, overview, summary],
  )
  const [choice, setChoice] = useState(encodeDecision(initialDecision))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('self-study')
  const [bodies, setBodies] = useState<Readonly<Record<string, string>>>({})
  const validTargets = listValidCurrentLessons(overview, summary, lesson.id)
  const confirmingCurrent = summary.currentLesson?.id === lesson.id
  const feedback = useMemo(
    () => lessonFeedbackStatus(overview, summary, lesson.id),
    [lesson.id, overview, summary],
  )
  const hasStudents = feedback.students.length > 0

  // D40 upsert 编辑态：已有反馈预填最新一条正文
  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const entry of feedback.students) {
      if (entry.latestNote !== null) initial[entry.student.id] = entry.latestNote.bodyMd
    }
    setBodies(initial)
  }, [feedback.students])

  const writtenEntries = feedback.students.filter((entry) => (bodies[entry.student.id] ?? '').trim() !== '')
  const hadAnyFeedback = feedback.students.some((entry) => entry.hasFeedback)
  // 软强制（D39）：一对一非空才可用；班课 ≥1 名学生有内容（V18-C 收窄到“到课学生”）
  const canSave = !hasStudents || writtenEntries.length > 0

  const scheduledSession = overview.lessonSessions.find((session) => session.lessonId === lesson.id)
  const occurredOn = useMemo(() => {
    const anchor = scheduledSession?.scheduledAt == null ? new Date() : new Date(scheduledSession.scheduledAt)
    const pad = (part: number): string => part.toString().padStart(2, '0')
    return `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`
  }, [scheduledSession?.scheduledAt])

  async function saveFeedbackThenConfirm(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      for (const entry of writtenEntries) {
        const existing = entry.latestNote
        if (existing === null) {
          await window.teacherWorkbench.core.createNote({
            studentId: entry.student.id,
            bodyMd: bodies[entry.student.id]!,
            lessonId: lesson.id,
            occurredOn,
          })
        } else {
          await window.teacherWorkbench.core.updateNote({
            noteId: existing.id,
            bodyMd: bodies[entry.student.id]!,
          })
        }
      }
      const result = await window.teacherWorkbench.core.confirmLessonTaught({
        courseId: summary.course.id,
        lessonId: lesson.id,
        expectedCurrentLessonId: summary.progress?.currentLessonId ?? null,
        decision: decodeDecision(choice),
      })
      await onSaved(
        result.status === 'already_confirmed'
          ? '本课此前已经确认，原确认时间和当前课次均未改变。'
          : writtenEntries.length > 0
            ? '已保存课后反馈并确认本课已上。'
            : '已确认本课已上。',
      )
      onClose()
    } catch (saveError) {
      setError(toErrorMessage(saveError, '操作失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmOnly(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      const result = await window.teacherWorkbench.core.confirmLessonTaught({
        courseId: summary.course.id,
        lessonId: lesson.id,
        expectedCurrentLessonId: summary.progress?.currentLessonId ?? null,
        decision: decodeDecision(choice),
      })
      await onSaved(
        result.status === 'already_confirmed'
          ? '本课此前已经确认，原确认时间和当前课次均未改变。'
          : '已确认本课已上；本课课后反馈已标记「缺反馈」，可随时在课次面板补写。',
      )
      onClose()
    } catch (saveError) {
      setError(toErrorMessage(saveError, '操作失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  function primaryAction(): void {
    if (saving || !canSave) return
    void saveFeedbackThenConfirm()
  }

  return (
    <Modal
      title={`确认「${lesson.title}」已上`}
      description="确认会记录实际上课时间；点名记录与此操作相互独立。"
      onClose={onClose}
      wide
    >
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
      {hasStudents ? (
        <LessonFeedbackSection
          overview={overview}
          summary={summary}
          lesson={lesson}
          bodies={bodies}
          onBodiesChange={setBodies}
        />
      ) : (
        <p className="feedback-empty">当前没有在读学生，无法写课后反馈。</p>
      )}
      <section className="modal-sec">
        <label className="modal-field">
          确认后的 Current Lesson
          <select value={choice} disabled={saving} onChange={(event) => setChoice(event.target.value)}>
            {!confirmingCurrent && (
              <option value="keep">保持原 Current Lesson 不变</option>
            )}
            <option value="clear">暂不设置下一课</option>
            {validTargets.map((target) => (
              <option key={target.id} value={`set:${target.id}`}>{formatLesson(summary, target)}</option>
            ))}
          </select>
        </label>
        <p className="modal-hint">系统只预选建议，最终按这里显示的明确决定保存；不会跨阶段自动推进。</p>
      </section>
      <footer className="modal-actions feedback-actions">
        <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>取消</button>
        {hasStudents && !skipOpen && (
          <button
            className="secondary-button feedback-skip-button"
            type="button"
            disabled={saving}
            onClick={() => { setSkipOpen(true) }}
          >
            {hadAnyFeedback ? '保持原反馈，只确认已上' : '跳过反馈，只确认已上'}
          </button>
        )}
        {hasStudents ? (
          <button
            className="primary-button"
            type="button"
            disabled={saving || !canSave}
            onClick={() => void primaryAction()}
          >
            {saving ? '保存中…' : hadAnyFeedback ? '✓ 更新反馈并确认已上' : '✓ 保存反馈并确认已上'}
          </button>
        ) : (
          <button className="primary-button" type="button" disabled={saving} onClick={() => void confirmOnly()}>
            {saving ? '确认中…' : '✓ 确认已上'}
          </button>
        )}
      </footer>
      {skipOpen && (
        <section className="skip-reason" role="group" aria-label="跳过反馈原因">
          <p>不写这条反馈吗？跳过后课次行会标「缺反馈」，可随时补写。</p>
          <label><input type="radio" name="skip-reason" checked={skipReason === 'self-study'} onChange={() => setSkipReason('self-study')} />本课是自习 / 考试 / 答疑，没有可写的教学内容</label>
          <label><input type="radio" name="skip-reason" checked={skipReason === 'later'} onChange={() => setSkipReason('later')} />我稍后再写（提醒我）</label>
          <footer className="modal-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={() => setSkipOpen(false)}>返回写反馈</button>
            <button className="danger-button" type="button" disabled={saving} onClick={() => void confirmOnly()}>仍然跳过，只确认已上</button>
          </footer>
        </section>
      )}
    </Modal>
  )
}

function encodeDecision(decision: CurrentLessonDecision): string {
  return decision.type === 'set' ? `set:${decision.lessonId}` : decision.type
}

function decodeDecision(value: string): CurrentLessonDecision {
  if (value === 'keep') return { type: 'keep' }
  if (value === 'clear') return { type: 'clear' }
  if (value.startsWith('set:') && value.length > 4) return { type: 'set', lessonId: value.slice(4) }
  throw new Error('下一课选择无效。')
}

function formatLesson(summary: CourseSummary, lesson: NodeRecord): string {
  const period = summary.periods.find((candidate) => candidate.id === lesson.parentId)
  const number = lesson.parentId === null ? 0 : getLessonNumber(summary.lessons, lesson.parentId, lesson.id)
  return `${period?.title ?? '未命名阶段'} · 第 ${number} 课 ${lesson.title}`
}
