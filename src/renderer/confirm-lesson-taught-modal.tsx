import { useEffect, useMemo, useState } from 'react'

import type { AttendanceStatus, CoreOverview, CurrentLessonDecision, LessonAttendanceRecord, NodeRecord } from '../shared/core-contracts'
import type { SkillRecord } from '../shared/skill-contracts'
import {
  getLessonNumber,
  lessonFeedbackStatus,
  listValidCurrentLessons,
  suggestConfirmedDecision,
  type CourseSummary,
} from './course-view-model'
import LessonFeedbackSection, {
  buildFeedbackNoteMetadata,
  type StudentFeedbackDraftState,
} from './lesson-feedback-section'
import Modal from './modal'
import { toErrorMessage } from './ui-utils'

/**
 * D39/D41：确认已上弹窗内嵌课后反馈区（软强制）。
 * 主按钮「保存反馈并确认已上」= 逐学生 upsert note（D40 幂等）→ confirmLessonTaught；
 * 班课首次点击存在到课学生未写时 missing-inline 点名提醒、再次点击按已写的保存、未写的跳过；
 * 跳过为次按钮（原因单选 + 红色二次确认）。
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
  const [drafts, setDrafts] = useState<Readonly<Record<string, StudentFeedbackDraftState>>>({})
  const [missingSeen, setMissingSeen] = useState(false)
  const validTargets = listValidCurrentLessons(overview, summary, lesson.id)
  const confirmingCurrent = summary.currentLesson?.id === lesson.id
  const feedback = useMemo(
    () => lessonFeedbackStatus(overview, summary, lesson.id),
    [lesson.id, overview, summary],
  )
  const hasStudents = feedback.students.length > 0

  // D41/D43/D44：到课状态、Skill 列表与 provider（保存 aiMetadata 用）按需加载
  const [attendance, setAttendance] = useState<LessonAttendanceRecord | null>(null)
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void window.teacherWorkbench.attendance.getLesson({ lessonId: lesson.id })
      .then((record) => active && setAttendance(record))
      .catch(() => active && setAttendance(null))
    void window.teacherWorkbench.skills.list()
      .then((list) => active && setSkills(list))
      .catch(() => active && setSkills([]))
    void window.teacherWorkbench.ai.getSettings()
      .then((settings) => active && setAiProvider(settings.provider))
      .catch(() => active && setAiProvider(null))
    return () => { active = false }
  }, [lesson.id])

  const statusByStudent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>()
    if (attendance === null) return map
    for (const entry of attendance.students) {
      if (entry.status !== null) map.set(entry.studentId, entry.status)
    }
    return map
  }, [attendance])

  // D40 upsert 编辑态：已有反馈预填最新一条正文
  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const entry of feedback.students) {
      if (entry.latestNote !== null) initial[entry.student.id] = entry.latestNote.bodyMd
    }
    setBodies(initial)
  }, [feedback.students])

  const writtenEntries = feedback.students.filter((entry) => (bodies[entry.student.id] ?? '').trim() !== '')
  const attendedEntries = feedback.students.filter((entry) => {
    const status = statusByStudent.get(entry.student.id)
    return status === undefined || status === 'present'
  })
  const attendedWritten = attendedEntries.filter((entry) => (bodies[entry.student.id] ?? '').trim() !== '')
  const attendedMissing = attendedEntries.filter((entry) => (bodies[entry.student.id] ?? '').trim() === '')
  const hadAnyFeedback = feedback.students.some((entry) => entry.hasFeedback)
  // 软强制（D39/D41）：一对一非空才可用；班课 ≥1 名到课学生有内容
  const canSave = !hasStudents || attendedWritten.length > 0
  const generationInFlight = Object.values(drafts).some((draft) => draft.phase === 'reading')

  const scheduledSession = overview.lessonSessions.find((session) => session.lessonId === lesson.id)
  const occurredOn = useMemo(() => {
    const anchor = scheduledSession?.scheduledAt == null ? new Date() : new Date(scheduledSession.scheduledAt)
    const pad = (part: number): string => part.toString().padStart(2, '0')
    return `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`
  }, [scheduledSession?.scheduledAt])

  async function saveFeedbackNotes(): Promise<void> {
    for (const entry of writtenEntries) {
      const existing = entry.latestNote
      if (existing === null) {
        const draft = drafts[entry.student.id]
        // D44/D40：AI 整理生成的反馈在 aiMetadata 记录来源；手写保存不写 aiMetadata
        const aiMetadata = aiProvider === null || draft === undefined
          ? undefined
          : buildFeedbackNoteMetadata(draft, aiProvider, skills)
        await window.teacherWorkbench.core.createNote({
          studentId: entry.student.id,
          bodyMd: bodies[entry.student.id]!,
          lessonId: lesson.id,
          occurredOn,
          ...(aiMetadata === undefined ? {} : { aiMetadata }),
        })
      } else {
        await window.teacherWorkbench.core.updateNote({
          noteId: existing.id,
          bodyMd: bodies[entry.student.id]!,
        })
      }
    }
  }

  async function saveFeedbackThenConfirm(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      await saveFeedbackNotes()
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
    // D41：班课到课学生未写——首次点击黄条点名提醒，再次点击按已写的保存、未写的跳过
    if (attendedMissing.length > 0 && !missingSeen) {
      setMissingSeen(true)
      return
    }
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
          attendance={attendance}
          bodies={bodies}
          drafts={drafts}
          onBodiesChange={setBodies}
          onDraftsChange={setDrafts}
          skills={skills}
        />
      ) : (
        <p className="feedback-empty">当前没有在读学生，无法写课后反馈。</p>
      )}
      {missingSeen && attendedMissing.length > 0 && (
        <div className="missing-inline" role="status">
          还有{attendedMissing.map((entry) => entry.student.name).join('、')}没写反馈：点学生姓名补写，或再次点击主按钮按「已写的保存、未写的跳过」继续。
        </div>
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
            onClick={() => setSkipOpen(true)}
          >
            {hadAnyFeedback ? '保持原反馈，只确认已上' : '跳过反馈，只确认已上'}
          </button>
        )}
        {hasStudents ? (
          <button
            className="primary-button"
            type="button"
            disabled={saving || !canSave || generationInFlight}
            onClick={() => primaryAction()}
          >
            {saving
              ? '保存中…'
              : missingSeen && attendedMissing.length > 0
                ? `按已写的保存，继续确认（跳过 ${attendedMissing.length} 人）`
                : hadAnyFeedback ? '✓ 更新反馈并确认已上' : '✓ 保存反馈并确认已上'}
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
