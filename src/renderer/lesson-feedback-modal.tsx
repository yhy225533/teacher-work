import { useEffect, useMemo, useState } from 'react'

import type { CoreOverview, LessonAttendanceRecord, NodeRecord } from '../shared/core-contracts'
import type { SkillRecord } from '../shared/skill-contracts'
import {
  lessonFeedbackStatus,
  type CourseSummary,
} from './course-view-model'
import LessonFeedbackSection, {
  buildFeedbackNoteMetadata,
  type StudentFeedbackDraftState,
} from './lesson-feedback-section'
import Modal from './modal'
import { toErrorMessage } from './ui-utils'

/**
 * D42 补写弹窗：复用反馈区（含录音/转写转反馈与反馈 Skill），无 Current Lesson 下拉、无确认按钮；
 * 跳过 = 直接关闭弹窗（课已确认）。保存 = 逐学生 upsert（D40 幂等，缺反馈走 create、已有走 update）。
 */
export default function LessonFeedbackModal({
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
  const [bodies, setBodies] = useState<Readonly<Record<string, string>>>({})
  const [drafts, setDrafts] = useState<Readonly<Record<string, StudentFeedbackDraftState>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attendance, setAttendance] = useState<LessonAttendanceRecord | null>(null)
  const [skills, setSkills] = useState<readonly SkillRecord[]>([])
  const [aiProvider, setAiProvider] = useState<string | null>(null)
  const feedback = useMemo(
    () => lessonFeedbackStatus(overview, summary, lesson.id),
    [lesson.id, overview, summary],
  )

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

  // D40 upsert 编辑态：已有反馈预填最新一条正文
  useEffect(() => {
    const initial: Record<string, string> = {}
    for (const entry of feedback.students) {
      if (entry.latestNote !== null) initial[entry.student.id] = entry.latestNote.bodyMd
    }
    setBodies(initial)
  }, [feedback.students])

  const writtenEntries = feedback.students.filter((entry) => (bodies[entry.student.id] ?? '').trim() !== '')
  const canSave = writtenEntries.length > 0
  const generationInFlight = Object.values(drafts).some((draft) => draft.phase === 'reading')

  const scheduledSession = overview.lessonSessions.find((session) => session.lessonId === lesson.id)
  const occurredOn = useMemo(() => {
    const anchor = scheduledSession?.scheduledAt == null ? new Date() : new Date(scheduledSession.scheduledAt)
    const pad = (part: number): string => part.toString().padStart(2, '0')
    return `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`
  }, [scheduledSession?.scheduledAt])

  async function save(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      for (const entry of writtenEntries) {
        const existing = entry.latestNote
        if (existing === null) {
          const draft = drafts[entry.student.id]
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
      await onSaved('课后反馈已保存，已挂到学生名下。')
      onClose()
    } catch (saveError) {
      setError(toErrorMessage(saveError, '保存失败，请稍后重试。'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`补写「${lesson.title}」课后反馈`}
      description={summary.course.title}
      onClose={onClose}
      wide
    >
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
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
      <footer className="modal-actions feedback-actions">
        <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>取消</button>
        <button
          className="primary-button"
          type="button"
          disabled={saving || !canSave || generationInFlight}
          onClick={() => void save()}
        >
          {saving ? '保存中…' : '✓ 保存反馈'}
        </button>
      </footer>
    </Modal>
  )
}
