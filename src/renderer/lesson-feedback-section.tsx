import { useMemo, useRef, useState } from 'react'

import type { AttendanceStatus, CoreOverview, LessonAttendanceRecord, NodeRecord } from '../shared/core-contracts'
import type { SkillRecord } from '../shared/skill-contracts'
import {
  FEEDBACK_BODY_MAX_CHARS,
  isGeneratedFeedback,
  type FeedbackNoteMetadata,
  type GeneratedFeedback,
  type TranscriptResult,
} from '../shared/feedback-contracts'
import { lessonFeedbackStatus, type CourseSummary, type LessonFeedbackStatus } from './course-view-model'
import { toErrorMessage } from './ui-utils'

/**
 * D41/D43/D44：确认已上与补写弹窗共用的课后反馈区（受控组件——宿主持有 bodies 并负责保存编排）。
 * 一对一 = 单学生直接编辑；班课 = 在读学生折叠列表（到课/请假/缺席徽标、待写/已写、请假可跳过）。
 * 录音/转写转反馈（rec-flow）与「反馈 Skill」工具行在本区头部，逐学生独立发起。
 */
export default function LessonFeedbackSection({
  overview,
  summary,
  lesson,
  attendance,
  bodies,
  drafts,
  onBodiesChange,
  onDraftsChange,
  skills,
}: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary
  readonly lesson: NodeRecord
  readonly attendance: LessonAttendanceRecord | null
  readonly bodies: Readonly<Record<string, string>>
  readonly drafts: Readonly<Record<string, StudentFeedbackDraftState>>
  readonly onBodiesChange: (bodies: Readonly<Record<string, string>>) => void
  readonly onDraftsChange: (drafts: Readonly<Record<string, StudentFeedbackDraftState>>) => void
  readonly skills: readonly SkillRecord[]
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

  // D41：到课状态来自既有点名记录（已点名时显示徽标）；未点名不显示
  const statusByStudent = useMemo(() => {
    const map = new Map<string, AttendanceStatus>()
    if (attendance === null) return map
    for (const entry of attendance.students) {
      if (entry.status !== null) map.set(entry.studentId, entry.status)
    }
    return map
  }, [attendance])

  const attendedEntries = feedback.students.filter((entry) => {
    const status = statusByStudent.get(entry.student.id)
    return status === undefined || status === 'present'
  })
  const attendedWrittenCount = attendedEntries
    .filter((entry) => (bodies[entry.student.id] ?? '').trim() !== '').length

  const [recFlowOpen, setRecFlowOpen] = useState(false)
  const [skillId, setSkillId] = useState('')

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
          <div className="fb-toolbar">
            <button
              className="rec-btn"
              type="button"
              aria-expanded={recFlowOpen}
              onClick={() => setRecFlowOpen((current) => !current)}
            >
              🎙 录音 / 转写转反馈
            </button>
            <label className="skill-inline skill-label">
              反馈 Skill
              <select value={skillId} onChange={(event) => setSkillId(event.target.value)}>
                <option value="">不使用 Skill（默认结构）</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>{skill.name}</option>
                ))}
              </select>
            </label>
            {isClass && (
              <span className="feedback-class-count">{attendedWrittenCount} / {attendedEntries.length} 已写</span>
            )}
          </div>
          {recFlowOpen && (
            <RecFlowBlock
              lesson={lesson}
              students={feedback.students}
              selectedSkill={skills.find((skill) => skill.id === skillId) ?? null}
              bodies={bodies}
              drafts={drafts}
              onBodiesChange={onBodiesChange}
              onDraftsChange={onDraftsChange}
            />
          )}
          <div className={isClass ? 'student-fb-list' : 'student-fb-list is-single'}>
            {feedback.students.map((entry) => (
              <FeedbackStudentRow
                key={entry.student.id}
                entry={entry}
                isClass={isClass}
                status={statusByStudent.get(entry.student.id) ?? null}
                body={bodies[entry.student.id] ?? ''}
                draft={drafts[entry.student.id]}
                onBodyChange={(value) => onBodiesChange({ ...bodies, [entry.student.id]: value })}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** D40/D43：AI 草稿来源状态——落 textarea 后标「AI 草稿」，人工改动后切「已人工修改」。 */
export interface StudentFeedbackDraftState {
  readonly phase: 'reading' | 'ready'
  readonly fileName: string
  readonly inputChars: number
  readonly truncated: boolean
  readonly generated: GeneratedFeedback | null
  readonly skillId: string
  readonly error: string
}

function FeedbackStudentRow({
  entry,
  isClass,
  status,
  body,
  draft,
  onBodyChange,
}: {
  readonly entry: LessonFeedbackStatus['students'][number]
  readonly isClass: boolean
  readonly status: AttendanceStatus | null
  readonly body: string
  readonly draft: StudentFeedbackDraftState | undefined
  readonly onBodyChange: (value: string) => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(!isClass)
  const written = body.trim() !== ''
  const skippedKind = status === 'leave' || status === 'absent'
  const generating = draft !== undefined && draft.phase === 'reading'
  return (
    <div className={`student-fb-row${!written && isClass && !skippedKind ? ' is-missing' : ''}${skippedKind ? ' is-absent' : ''}`}>
      {isClass && (
        <button
          className="student-fb-head"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="caret" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <b>{entry.student.name}</b>
          {status !== null && (
            <i className={`att-chip${status === 'leave' ? ' leave' : status === 'absent' ? ' absent' : ''}`}>
              {status === 'present' ? '到课' : status === 'leave' ? '请假' : '缺席'}
            </i>
          )}
          {entry.hasFeedback && <i className="att-chip existing">已有反馈</i>}
          <span className={`st${written ? ' done' : skippedKind ? ' skipped' : ' missing'}`}>
            {written ? '已写 ✓' : skippedKind ? '可跳过' : '待写'}
          </span>
        </button>
      )}
      {(expanded || !isClass) && (
        <div className="student-fb-body">
          <textarea
            value={body}
            maxLength={FEEDBACK_BODY_MAX_CHARS}
            disabled={generating}
            placeholder={skippedKind
              ? '本课请假 · 可跳过（填写也会保存）'
              : '写本课的课后反馈：课堂内容 / 掌握情况 / 作业与下节安排…'}
            onChange={(event) => onBodyChange(event.target.value)}
          />
          {draft?.generated !== undefined && draft.generated !== null && (
            <p className={`draft-origin${body !== draft.generated.draftText ? ' is-edited' : ''}`}>
              {body !== draft.generated.draftText ? '已人工修改 ✓' : 'AI 草稿 · 请人工修改'}
            </p>
          )}
          {generating && <p className="draft-origin is-running">正在读取转写并整理…</p>}
          {isClass && entry.hasFeedback && (
            <p className="student-fb-existing">已有反馈将按修改后的内容更新（不会重复建第二条）。</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * D43 rec-flow：路径 A 主入口（选 .txt/.md → read-transcript → 自动 generate → 草稿落 textarea）；
 * 路径 B 纯录音置灰（需设置页语音模型，后续版本）。
 */
function RecFlowBlock({
  lesson,
  students,
  selectedSkill,
  bodies,
  drafts,
  onBodiesChange,
  onDraftsChange,
}: {
  readonly lesson: NodeRecord
  readonly students: readonly LessonFeedbackStatus['students'][number][]
  readonly selectedSkill: SkillRecord | null
  readonly bodies: Readonly<Record<string, string>>
  readonly drafts: Readonly<Record<string, StudentFeedbackDraftState>>
  readonly onBodiesChange: (bodies: Readonly<Record<string, string>>) => void
  readonly onDraftsChange: (drafts: Readonly<Record<string, StudentFeedbackDraftState>>) => void
}): React.JSX.Element {
  const [targetStudentId, setTargetStudentId] = useState(students[0]?.student.id ?? '')
  const [error, setError] = useState('')
  // D43：取消/重新选择材料后，迟到的整理结果不得回填（不覆盖老师已手写的内容）
  const generationToken = useRef(0)
  const target = students.find((entry) => entry.student.id === targetStudentId)

  async function pickAndGenerate(): Promise<void> {
    if (target === undefined) return
    setError('')
    const token = ++generationToken.current
    onDraftsChange({ ...drafts, [target.student.id]: {
      phase: 'reading',
      fileName: '',
      inputChars: 0,
      truncated: false,
      generated: null,
      skillId: selectedSkill?.id ?? '',
      error: '',
    } })
    try {
      const transcript: TranscriptResult | null =
        await window.teacherWorkbench.feedback.readTranscript()
      if (transcript === null) {
        if (generationToken.current === token) onDraftsChange({ ...drafts })
        return
      }
      const generated = await window.teacherWorkbench.feedback.generate({
        lessonId: lesson.id,
        studentId: target.student.id,
        transcriptText: transcript.text,
        ...(selectedSkill === null ? {} : { skillId: selectedSkill.id }),
      })
      if (!isGeneratedFeedback(generated)) {
        throw new Error('AI 返回的反馈草稿无效。')
      }
      if (generationToken.current !== token) return
      onDraftsChange({
        ...drafts,
        [target.student.id]: {
          phase: 'ready',
          fileName: transcript.fileName,
          inputChars: transcript.chars,
          truncated: transcript.truncated,
          generated,
          skillId: selectedSkill?.id ?? '',
          error: '',
        },
      })
      // 草稿落 textarea：计数与主按钮 gating 即时更新（D43）
      onBodiesChange({ ...bodies, [target.student.id]: generated.draftText })
    } catch (generateError) {
      setError(toErrorMessage(generateError, 'AI 整理失败，请稍后重试。'))
      if (generationToken.current === token) onDraftsChange({ ...drafts })
    }
  }

  /** D43：取消/重新选择材料——中断展示态并作废在途结果，不动老师已手写内容。 */
  function cancelDraft(): void {
    generationToken.current++
    if (target === undefined) return
    onDraftsChange({ ...drafts })
    setError('')
  }

  const currentDraft = target === undefined ? undefined : drafts[target.student.id]
  const busy = currentDraft?.phase === 'reading'

  return (
    <div className="rec-flow">
      <div className="rec-flow-head">
        <b>录音 / 转写转反馈</b>
        {students.length > 1 && (
          <label className="skill-label">
            整理给
            <select value={targetStudentId} disabled={busy} onChange={(event) => setTargetStudentId(event.target.value)}>
              {students.map((entry) => (
                <option key={entry.student.id} value={entry.student.id}>{entry.student.name}</option>
              ))}
            </select>
          </label>
        )}
        <button className="rec-flow-close" type="button" aria-label="收起" onClick={cancelDraft}>✕</button>
      </div>
      {error !== '' && <div className="inline-error" role="alert">{error}</div>}
      <div className="rec-paths">
        <div className="rec-upload">
          <span className="glyph" aria-hidden="true">📝</span>
          <div>
            <p>导入转写文字<span className="path-tag">主路径</span></p>
            <small>手机录音 App 的转写文件：.txt / .md；AI 直接按反馈结构整理 · 无需额外配置</small>
          </div>
          <button type="button" disabled={busy || target === undefined} onClick={() => void pickAndGenerate()}>
            {busy ? '整理中…' : '选择文件…'}
          </button>
        </div>
        <div className="rec-upload is-off" aria-disabled="true">
          <span className="glyph" aria-hidden="true">🎧</span>
          <div>
            <p>上传纯录音<span className="path-tag off">未配置语音模型</span></p>
            <small>需先在设置页配置语音模型（后续版本支持）</small>
          </div>
          <button type="button" disabled title="未配置语音模型 · 后续版本支持">选择录音…</button>
        </div>
      </div>
      {currentDraft?.generated !== undefined && currentDraft.generated !== null && (
        <div className="rec-file">
          <span className="chip">
            <b>{currentDraft.fileName}</b>
            <small>{currentDraft.inputChars} 字{currentDraft.truncated ? ' · 已截取前 30000 字' : ''}</small>
          </span>
          <span className="rec-stage done">✓ 草稿就绪，请人工修改后保存</span>
        </div>
      )}
      <p className="rec-note">转写文字只用于本次整理，不保存到工作台；生成的草稿会先填入上方编辑框，人工修改后才保存。</p>
    </div>
  )
}

/** D40：由草稿状态构造 FeedbackNoteMetadata（保存时挂到 createNote 的 aiMetadata；skill 快照按保存时列表解析）。 */
export function buildFeedbackNoteMetadata(
  draft: StudentFeedbackDraftState,
  provider: string,
  skills: readonly SkillRecord[],
): FeedbackNoteMetadata | undefined {
  if (draft.generated === null) return undefined
  const skill = draft.skillId === '' ? undefined : skills.find((candidate) => candidate.id === draft.skillId)
  return {
    generatedBy: 'feedback-assistant',
    promptVersion: draft.generated.promptVersion,
    provider,
    model: draft.generated.model,
    ...(skill === undefined ? {} : { skill: { id: skill.id, name: skill.name, prompt: skill.prompt } }),
    transcriptChars: draft.inputChars,
  }
}
