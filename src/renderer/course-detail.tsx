import { useEffect, useState, type FormEvent } from 'react'

import type { CoreOverview, LessonSessionSummary, NodeRecord, NoteRecord } from '../shared/core-contracts'
import type { ManagedFileOverview } from '../shared/file-contracts'
import { AppMenuButton, type AppMenuEntry } from './app-menu'
import {
  formatLocalDateOnly,
  formatLocalDateTime,
  getLessonNumber,
  lessonFeedbackStatus,
  listValidCurrentLessons,
  localDateTimeToUtc,
  toDateTimeLocalValue,
  type CourseSummary,
} from './course-view-model'
import { createLessonPrepContext, listLessonPrepFiles, splitLessonFilesByRole, type LessonPrepContext } from './lesson-prep-context'
import LessonFeedbackModal from './lesson-feedback-modal'
import Modal from './modal'

type CourseTab = 'lessons' | 'students' | 'materials'

// V1.2 courseware contract migrated to TeachingContentPage: <LessonFilesSection lesson={viewedLesson} />
// Legacy tab tuple ['materials', '资料'] remains documented here so the migration is auditable.

export default function CourseDetail({
  overview,
  summary,
  viewedLessonId,
  busy,
  courseCount,
  draftCount,
  onViewLesson,
  onStartPrep,
  onOpenDraft,
  onOpenAttendance,
  onConfirmTaught,
  onOpenStudent,
  onOpenTeachingContent,
  onOpenDraftInbox,
  onQuickCourse,
  onCreateCourse,
  onReload,
  onAction,
}: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary | null
  readonly viewedLessonId: string
  readonly busy: boolean
  readonly courseCount: number
  readonly draftCount: number
  readonly onViewLesson: (lessonId: string) => void
  readonly onStartPrep: (context: LessonPrepContext) => void
  readonly onOpenDraft: (context: LessonPrepContext, noteId: string) => void
  readonly onOpenAttendance: (lessonId: string) => void
  readonly onConfirmTaught: (lessonId: string) => void
  readonly onOpenStudent: (studentId: string) => void
  readonly onOpenTeachingContent: (context: LessonPrepContext) => void
  readonly onOpenDraftInbox: () => void
  readonly onQuickCourse: () => void
  readonly onCreateCourse: () => void
  readonly onReload: () => void
  readonly onAction: (action: () => Promise<void>, successMessage: string) => Promise<boolean>
}): React.JSX.Element {
  const [tab, setTab] = useState<Exclude<CourseTab, 'materials'>>('lessons')
  const [createPeriodOpen, setCreatePeriodOpen] = useState(false)
  const [createLessonPeriodId, setCreateLessonPeriodId] = useState<string | null>(null)
  const [scheduleLessonId, setScheduleLessonId] = useState<string | null>(null)
  const [progressOpen, setProgressOpen] = useState(false)
  const [feedbackLessonId, setFeedbackLessonId] = useState<string | null>(null)
  const [expandedPeriodIds, setExpandedPeriodIds] = useState<ReadonlySet<string>>(new Set())
  // V19-C（D58）：行动卡讲义/材料 chips 计数——复用既有 files:get-overview 通道，零新增 IPC。
  const [filesOverview, setFilesOverview] = useState<ManagedFileOverview | null>(null)

  useEffect(() => {
    setExpandedPeriodIds(new Set())
  }, [summary?.course.id])

  useEffect(() => {
    let cancelled = false
    window.teacherWorkbench.files.getOverview()
      .then((files) => { if (!cancelled) setFilesOverview(files) })
      .catch(() => { if (!cancelled) setFilesOverview(null) })
    return () => { cancelled = true }
  }, [])

  useEffect(
    () => window.teacherWorkbench.files.onContentChanged(() => {
      window.teacherWorkbench.files.getOverview()
        .then(setFilesOverview)
        .catch(() => { /* 保留上次计数，下一次内容变更再刷新。 */ })
    }),
    [],
  )

  useEffect(() => {
    if (summary === null) return
    if (!summary.lessons.some((lesson) => lesson.id === viewedLessonId)) {
      onViewLesson(summary.currentLesson?.id ?? summary.lessons[0]?.id ?? '')
    }
  }, [onViewLesson, summary, viewedLessonId])

  if (summary === null) {
    return (
      <section className="course-detail-pane course-detail-empty">
        <div>
          <h2>选择一门课程</h2>
          <p>在左侧课程列表中选择课程，右侧会显示阶段、课次、学生和资料入口。</p>
          <div className="course-empty-actions">
            <button className="secondary-button" type="button" disabled={busy} onClick={onCreateCourse}>仅创建课程</button>
            <button className="primary-button" type="button" disabled={busy} onClick={onQuickCourse}>+ 快速建课</button>
          </div>
        </div>
      </section>
    )
  }

  const viewedLesson = summary.lessons.find((lesson) => lesson.id === viewedLessonId) ?? null
  const viewedDraft = viewedLesson === null ? null : latestLessonDraft(overview, viewedLesson.id)

  // V19-C（D58）：行动卡主角 = Viewed Lesson，缺省回落 Current Lesson；chips/行动键全部指向主角课次。
  const hero = viewedLesson ?? summary.currentLesson
  const heroSession = hero === null ? undefined : overview.lessonSessions.find((candidate) => candidate.lessonId === hero.id)
  const heroPeriod = summary.periods.find((period) => period.id === hero?.parentId) ?? null
  const heroNumber = hero !== null && hero.parentId !== null
    ? getLessonNumber(summary.lessons, hero.parentId, hero.id)
    : null
  const heroFilesByRole = filesOverview === null || hero === null
    ? null
    : splitLessonFilesByRole(listLessonPrepFiles(filesOverview, hero.id))
  const previousTaught = previousTaughtLesson(overview, summary, hero?.id ?? null)
  const heroFeedbackChip = (() => {
    if (previousTaught === null) return null
    const feedback = lessonFeedbackStatus(overview, summary, previousTaught.id)
    if (feedback.students.length === 0) return null
    return (
      <span className={feedback.complete ? 'hero-chip is-feedback-done' : 'hero-chip is-missing'}>
        上节反馈 {feedback.complete ? '✓' : '✍ 待补写'}
      </span>
    )
  })()
  // ⋯ 收纳菜单（D58）：本课 / 本课程 / 全局三分组；危险项分隔线后置底红区。统计与建课入口收进"全局"组。
  const heroMenuEntries: AppMenuEntry[] = summary.ended ? [
    { kind: 'group', key: 'hero-group-course', label: '本课程' },
    { kind: 'item', key: 'hero-students', label: '学生名单', onSelect: () => { setTab('students') } },
    { kind: 'item', key: 'hero-drafts', label: `修改记录 ${draftCount}`, onSelect: onOpenDraftInbox },
    { kind: 'separator', key: 'hero-sep-global' },
    { kind: 'group', key: 'hero-group-global', label: '全局' },
    { kind: 'item', key: 'hero-all-courses', label: `全部课程 ${courseCount}`, disabled: true, title: '工作台内课程总数（统计）', onSelect: () => {} },
    { kind: 'item', key: 'hero-quick-course', label: '+ 快速建课', onSelect: onQuickCourse },
    { kind: 'item', key: 'hero-create-course', label: '+ 仅创建课程', onSelect: onCreateCourse },
    { kind: 'item', key: 'hero-reload', label: '刷新', onSelect: onReload },
    { kind: 'separator', key: 'hero-sep-danger' },
    { kind: 'item', key: 'hero-reopen', label: '重新开启课程', danger: true, disabled: busy, onSelect: () => {
      void onAction(
        async () => { await window.teacherWorkbench.core.reopenCourse({ courseId: summary.course.id }).then(() => undefined) },
        '课程已重新开启，原有效进度位置已保留。',
      )
    } },
  ] : [
    { kind: 'group', key: 'hero-group-lesson', label: '本课' },
    { kind: 'item', key: 'hero-progress', label: '调整当前课次', disabled: busy || summary.lessons.length === 0, onSelect: () => { setProgressOpen(true) } },
    { kind: 'item', key: 'hero-schedule', label: '设置时间', disabled: busy || hero === null, onSelect: () => { if (hero !== null) setScheduleLessonId(hero.id) } },
    { kind: 'separator', key: 'hero-sep-course' },
    { kind: 'group', key: 'hero-group-course', label: '本课程' },
    { kind: 'item', key: 'hero-students', label: '学生名单', onSelect: () => { setTab('students') } },
    { kind: 'item', key: 'hero-drafts', label: `修改记录 ${draftCount}`, onSelect: onOpenDraftInbox },
    { kind: 'separator', key: 'hero-sep-global' },
    { kind: 'group', key: 'hero-group-global', label: '全局' },
    { kind: 'item', key: 'hero-all-courses', label: `全部课程 ${courseCount}`, disabled: true, title: '工作台内课程总数（统计）', onSelect: () => {} },
    { kind: 'item', key: 'hero-quick-course', label: '+ 快速建课', onSelect: onQuickCourse },
    { kind: 'item', key: 'hero-create-course', label: '+ 仅创建课程', onSelect: onCreateCourse },
    { kind: 'item', key: 'hero-reload', label: '刷新', onSelect: onReload },
    { kind: 'separator', key: 'hero-sep-danger' },
    { kind: 'item', key: 'hero-end-course', label: '结束课程', danger: true, disabled: busy, onSelect: () => {
      void onAction(
        async () => { await window.teacherWorkbench.core.endCourse({ courseId: summary.course.id }).then(() => undefined) },
        '课程已结束，课程树和历史记录均已保留。',
      )
    } },
  ]

  return (
    <section className="course-detail-pane" aria-label="课程详情">
      {/* V19-C（D58）：静态课程名片退役 → 当前课次行动卡。 */}
      <header className="lesson-hero-card">
        <div className="lesson-hero-main">
          <p className="lesson-hero-crumb">
            {summary.course.title} · {summary.course.courseMode === 'one_to_one' ? '一对一' : '班课'} · {heroPeriod?.title ?? '未分组'} · 共 {summary.lessons.length} 课{heroNumber === null ? '' : `（第 ${heroNumber} 课）`}
          </p>
          {hero === null ? (
            <h2 className="lesson-hero-title">还没有课次<span className="hero-hint">先创建阶段与课次；第一课创建后会设为 Current Lesson。</span></h2>
          ) : (
            <h2 className="lesson-hero-title">
              {hero.title}
              {summary.currentLesson?.id === hero.id && !summary.ended && <em className="is-current">Current</em>}
              {heroSession?.taughtConfirmedAt != null && <em>已上</em>}
              {summary.ended && <em>已结束</em>}
            </h2>
          )}
          {hero !== null && (
            <div className="lesson-hero-chips">
              <span className="hero-chip">🕘 {formatSessionSchedule(heroSession)}</span>
              <span className="hero-chip">👤 {heroStudentLine(summary)}</span>
              {heroFilesByRole !== null && <span className="hero-chip">📘 讲义 {heroFilesByRole.lecture.length}</span>}
              {heroFilesByRole !== null && <span className="hero-chip">📎 材料 {heroFilesByRole.materials.length}</span>}
              {heroFeedbackChip}
            </div>
          )}
        </div>
        <div className="lesson-hero-actions">
          {hero === null && !summary.ended && (
            <button className="primary-button" type="button" disabled={busy} onClick={() => setCreatePeriodOpen(true)}>+ 新建阶段</button>
          )}
          {hero !== null && (
            <button
              className="primary-button"
              type="button"
              onClick={() => onOpenTeachingContent(createLessonPrepContext(summary.course, hero, summary.activeStudents, heroPeriod?.title))}
            >
              {summary.ended ? '查看教学内容' : '▶ 进入教学内容'}
            </button>
          )}
          {hero !== null && (
            <button className="secondary-button" type="button" disabled={busy || summary.ended} onClick={() => onOpenAttendance(hero.id)}>
              {heroSession?.attendanceRecordedAt == null ? '点名' : '修改点名'}
            </button>
          )}
          {hero !== null && heroSession?.taughtConfirmedAt == null && (
            <button className="secondary-button" type="button" disabled={busy || summary.ended} onClick={() => onConfirmTaught(hero.id)}>确认本课已上</button>
          )}
          <AppMenuButton label="⋯" entries={heroMenuEntries} align="right" />
        </div>
      </header>

      <nav className="course-detail-tabs" aria-label="课程详情分区">
        {([
          ['lessons', '课次'],
          ['students', '学生'],
        ] as const).map(([value, label]) => (
          <button
            className={tab === value ? 'is-active' : ''}
            type="button"
            key={value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'lessons' ? (
        <LessonsSection
          overview={overview}
          summary={summary}
          viewedLesson={viewedLesson}
          busy={busy}
          onViewLesson={onViewLesson}
          onCreatePeriod={() => setCreatePeriodOpen(true)}
          onCreateLesson={setCreateLessonPeriodId}
          onSchedule={setScheduleLessonId}
          onOpenAttendance={onOpenAttendance}
          onConfirmTaught={onConfirmTaught}
          onOpenTeachingContent={onOpenTeachingContent}
          onStartPrep={onStartPrep}
          onOpenDraft={onOpenDraft}
          viewedDraft={viewedDraft}
          expandedPeriodIds={expandedPeriodIds}
          onTogglePeriod={(periodId) => setExpandedPeriodIds((current) => {
            const next = new Set(current)
            if (next.has(periodId)) next.delete(periodId)
            else next.add(periodId)
            return next
          })}
          onOpenFeedback={setFeedbackLessonId}
          onAction={onAction}
        />
      ) : tab === 'students' ? (
        <CourseStudentsSection
          overview={overview}
          summary={summary}
          busy={busy}
          onOpenStudent={onOpenStudent}
          onAction={onAction}
        />
      ) : null}

      {createPeriodOpen && (
        <CreatePeriodModal
          summary={summary}
          busy={busy}
          onClose={() => setCreatePeriodOpen(false)}
          onAction={onAction}
        />
      )}
      {createLessonPeriodId !== null && (
        <CreateLessonModal
          summary={summary}
          periodId={createLessonPeriodId}
          busy={busy}
          onViewLesson={onViewLesson}
          onClose={() => setCreateLessonPeriodId(null)}
          onAction={onAction}
        />
      )}
      {scheduleLessonId !== null && (
        <ScheduleLessonModal
          overview={overview}
          lessonId={scheduleLessonId}
          busy={busy}
          onClose={() => setScheduleLessonId(null)}
          onAction={onAction}
        />
      )}
      {feedbackLessonId !== null && (() => {
        const lesson = summary.lessons.find((candidate) => candidate.id === feedbackLessonId)
        if (lesson === undefined) return null
        return (
          <LessonFeedbackModal
            overview={overview}
            summary={summary}
            lesson={lesson}
            onClose={() => setFeedbackLessonId(null)}
            onSaved={async (message) => { await onAction(async () => undefined, message) }}
          />
        )
      })()}
      {progressOpen && (
        <ProgressModal
          overview={overview}
          summary={summary}
          viewedLessonId={viewedLessonId}
          busy={busy}
          onClose={() => setProgressOpen(false)}
          onAction={onAction}
        />
      )}
    </section>
  )
}

export function LessonsSection({
  overview,
  summary,
  viewedLesson,
  busy,
  onViewLesson,
  onCreatePeriod,
  onCreateLesson,
  onSchedule,
  onOpenAttendance,
  onConfirmTaught,
  onOpenTeachingContent,
  onStartPrep,
  onOpenDraft,
  viewedDraft,
  expandedPeriodIds,
  onTogglePeriod,
  onOpenFeedback,
  onAction,
}: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary
  readonly viewedLesson: NodeRecord | null
  readonly busy: boolean
  readonly onViewLesson: (lessonId: string) => void
  readonly onCreatePeriod: () => void
  readonly onCreateLesson: (periodId: string) => void
  readonly onSchedule: (lessonId: string) => void
  readonly onOpenAttendance: (lessonId: string) => void
  readonly onConfirmTaught: (lessonId: string) => void
  readonly onOpenTeachingContent: (context: LessonPrepContext) => void
  readonly onStartPrep: (context: LessonPrepContext) => void
  readonly onOpenDraft: (context: LessonPrepContext, noteId: string) => void
  readonly viewedDraft: NoteRecord | null
  readonly expandedPeriodIds: ReadonlySet<string>
  readonly onTogglePeriod: (periodId: string) => void
  readonly onOpenFeedback: (lessonId: string) => void
  readonly onAction: (action: () => Promise<void>, successMessage: string) => Promise<boolean>
}): React.JSX.Element {
  const sessionByLesson = new Map(overview.lessonSessions.map((session) => [session.lessonId, session]))
  const viewedSession = viewedLesson === null ? undefined : sessionByLesson.get(viewedLesson.id)
  const viewedPeriod = summary.periods.find((period) => period.id === viewedLesson?.parentId)
  return (
    <div className="course-lessons-section">
      <div className="section-toolbar">
        <div><h3>阶段与课次</h3><p>单击选择课次；双击查看这节课的教学内容。Current Lesson 不会因此改变。</p></div>
        <button className="secondary-button" type="button" disabled={busy || summary.ended} onClick={onCreatePeriod}>+ 新建阶段</button>
      </div>
      <div className="period-list">
        {summary.periods.map((period) => {
          const lessons = summary.lessons.filter((lesson) => lesson.parentId === period.id)
          const expanded = expandedPeriodIds.has(period.id)
          return (
            <section className="period-block" key={period.id}>
              <header>
                <button
                  className="period-toggle"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`period-lessons-${period.id}`}
                  onClick={() => onTogglePeriod(period.id)}
                >
                  <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                  <strong>{period.title}</strong>
                </button>
                <button className="link-button" type="button" disabled={busy || summary.ended} onClick={() => onCreateLesson(period.id)}>+ 新建课次</button>
              </header>
                  {expanded && <div className="lesson-row-list" id={`period-lessons-${period.id}`}>
                  {lessons.map((lesson, index) => {
                    const session = sessionByLesson.get(lesson.id)
                    const feedback = lessonFeedbackStatus(overview, summary, lesson.id)
                    const showFeedbackBadge = session?.taughtConfirmedAt != null && feedback.students.length > 0
                    return (
                      <button
                        className={`lesson-row${viewedLesson?.id === lesson.id ? ' is-viewed' : ''}`}
                        type="button"
                        key={lesson.id}
                        onClick={() => onViewLesson(lesson.id)}
                        onDoubleClick={() => onOpenTeachingContent(createLessonPrepContext(summary.course, lesson, summary.activeStudents, period.title))}
                      >
                        <span className="lesson-number">{lesson.lessonLabel ?? `第 ${index + 1} 课`}</span>
                        <strong>{lesson.title}</strong>
                        <span className="lesson-row-status">
                          {session?.taughtConfirmedAt !== null && session?.taughtConfirmedAt !== undefined && <em>已上</em>}
                          {session?.scheduledOn !== undefined && session.taughtConfirmedAt === null && <em>历史</em>}
                          {summary.currentLesson?.id === lesson.id && <em className="is-current">Current</em>}
                          {session?.attendanceRecordedAt !== null && session?.attendanceRecordedAt !== undefined && <em>已点名</em>}
                          {showFeedbackBadge && (feedback.complete
                            ? <em>已反馈</em>
                            : <em className="is-missing">缺反馈</em>)}
                          {session?.scheduledOn !== null && session?.scheduledOn !== undefined
                            ? <small>{formatLocalDateOnly(session.scheduledOn)} · {session.scheduledAt === null ? '时间未记录' : formatLocalDateTime(session.scheduledAt)}</small>
                            : session?.scheduledAt !== null && session?.scheduledAt !== undefined && <small>{formatLocalDateTime(session.scheduledAt)}</small>}
                          {session?.durationMinutes !== null && session?.durationMinutes !== undefined && <small>{session.durationMinutes} 分钟</small>}
                        </span>
                      </button>
                    )
                  })}
                  {lessons.length === 0 && <p className="empty-state">该阶段还没有课次。</p>}
                </div>}
            </section>
          )
        })}
        {summary.periods.length === 0 && (
          <div className="course-zero-state">
            <h3>先创建第一个阶段</h3>
            <p>课程创建成功后，阶段与课次分开建立；第一课创建后会初始化为 Current Lesson。</p>
            <button className="primary-button" type="button" disabled={busy || summary.ended} onClick={onCreatePeriod}>创建阶段</button>
          </div>
        )}
      </div>

      {viewedLesson !== null && (
        <aside className="viewed-lesson-panel">
          <div>
            <span className="viewed-label">Viewed Lesson</span>
            <h3>{viewedLesson.title}</h3>
            <p>排课：{formatSessionSchedule(viewedSession)} · 时长：{viewedSession?.durationMinutes === null || viewedSession === undefined ? '未设置' : `${viewedSession.durationMinutes} 分钟`} · 点名：{viewedSession?.attendanceRecordedAt === null || viewedSession === undefined ? '未保存' : `已记录 ${viewedSession.totalCount} 人`}</p>
          </div>
          <div className="viewed-lesson-actions">
            {!summary.ended && <button className="primary-button" type="button" onClick={() => {
              const context = createLessonPrepContext(summary.course, viewedLesson, summary.activeStudents, viewedPeriod?.title)
              if (viewedDraft === null) onStartPrep(context)
              else onOpenDraft(context, viewedDraft.id)
            }}>{viewedDraft === null ? '开始备课' : '继续备课'}</button>}
            <button className="secondary-button" type="button" onClick={() => onOpenTeachingContent(createLessonPrepContext(summary.course, viewedLesson, summary.activeStudents, viewedPeriod?.title))}>查看教学内容</button>
            <button className="secondary-button" type="button" disabled={busy || summary.ended} onClick={() => onSchedule(viewedLesson.id)}>设置时间</button>
            <button className="secondary-button" type="button" disabled={busy || summary.ended} onClick={() => onOpenAttendance(viewedLesson.id)}>
              {viewedSession?.attendanceRecordedAt === null || viewedSession === undefined ? '点名' : '修改点名'}
            </button>
            {viewedSession?.taughtConfirmedAt === null || viewedSession === undefined ? (
              <button className="secondary-button" type="button" disabled={busy || summary.ended} onClick={() => onConfirmTaught(viewedLesson.id)}>确认本课已上</button>
            ) : (
              <details className="lesson-more-menu">
                <summary>更多</summary>
                <button className="danger-button" type="button" disabled={busy} onClick={() => void onAction(
                  async () => window.teacherWorkbench.core.undoLessonTaught({
                    courseId: summary.course.id,
                    lessonId: viewedLesson.id,
                  }),
                  '已撤销本课已上；Current Lesson 未自动回退。',
                )}>撤销本课已上</button>
              </details>
            )}
          </div>
          {viewedFeedbackBlock({ overview, summary, lesson: viewedLesson, onOpenFeedback })}
        </aside>
      )}
    </div>
  )
}

/** D42：Viewed Lesson 反馈区——已上缺反馈黄条 + 补写入口；已上有反馈显示摘要行；未上不显示。 */
function viewedFeedbackBlock({
  overview,
  summary,
  lesson,
  onOpenFeedback,
}: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary
  readonly lesson: NodeRecord
  readonly onOpenFeedback: (lessonId: string) => void
}): React.JSX.Element | null {
  const feedback = lessonFeedbackStatus(overview, summary, lesson.id)
  if (!feedback.taught || feedback.students.length === 0) return null
  if (!feedback.complete) {
    return (
      <div className="feedback-alert" role="status">
        <span>本课缺反馈 · 确认已上时跳过了课后反馈</span>
        <button className="secondary-button" type="button" onClick={() => onOpenFeedback(lesson.id)}>✍ 补写反馈</button>
      </div>
    )
  }
  const notes = feedback.students
    .flatMap((entry) => (entry.latestNote === null ? [] : [entry.latestNote]))
    .sort((left, right) => (right.occurredOn ?? right.updatedAt).localeCompare(left.occurredOn ?? left.updatedAt))
  if (notes.length === 0) return null
  const latest = notes[0]!
  const owner = feedback.students.find((entry) => entry.latestNote?.id === latest.id)?.student.name ?? '学生'
  return (
    <p className="feedback-summary-line">
      本课反馈（{notes.length} 条）：「{feedbackFirstLine(latest.bodyMd)}」 — 已挂到 {owner} 名下
      {!feedback.students.every((entry) => entry.student.name === owner) && (
        <button className="link-button" type="button" onClick={() => onOpenFeedback(lesson.id)}>补写其他学生</button>
      )}
    </p>
  )
}

function feedbackFirstLine(body: string): string {
  const firstLine = body.split(/\r?\n/, 1)[0] ?? ''
  return Array.from(firstLine.trim()).slice(0, 40).join('')
}

function CourseStudentsSection({ overview, summary, busy, onOpenStudent, onAction }: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary
  readonly busy: boolean
  readonly onOpenStudent: (studentId: string) => void
  readonly onAction: (action: () => Promise<void>, successMessage: string) => Promise<boolean>
}): React.JSX.Element {
  const [studentId, setStudentId] = useState('')
  const linkedIds = new Set(summary.links.map((link) => link.studentId))
  const candidates = overview.students.filter((student) => !linkedIds.has(student.id))
  return (
    <div className="course-students-section">
      <div className="section-toolbar">
        <div><h3>在读学生</h3><p>退出与重新加入只改变课程关系，不删除历史点名或学习记录。</p></div>
      </div>
      <div className="student-link-row">
        <select aria-label="关联已有学生" value={studentId} disabled={busy || candidates.length === 0 || summary.ended} onChange={(event) => setStudentId(event.target.value)}>
          <option value="">选择已有学生</option>
          {candidates.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
        </select>
        <button className="primary-button" type="button" disabled={busy || studentId === '' || summary.ended} onClick={() => void onAction(
          async () => {
            await window.teacherWorkbench.core.linkStudentToCourse({ courseId: summary.course.id, studentId })
            setStudentId('')
          },
          '学生已关联到课程。',
        )}>关联学生</button>
      </div>
      <div className="course-student-list">
        {summary.activeStudents.map((student) => (
          <div className="course-student-row" key={student.id}>
            <button className="student-name-button" type="button" onClick={() => onOpenStudent(student.id)}>{student.name}</button><span>在读</span>
            <button className="danger-button" type="button" disabled={busy || summary.ended} onClick={() => void onAction(
              async () => {
                await window.teacherWorkbench.core.endCourseStudentLink({
                  courseId: summary.course.id,
                  studentId: student.id,
                })
              },
              '学生已退出课程，历史记录保持不变。',
            )}>标记退出</button>
          </div>
        ))}
        {summary.activeStudents.length === 0 && <p className="empty-state">当前没有在读学生。</p>}
      </div>
      {summary.historicalStudents.length > 0 && (
        <details className="historical-students">
          <summary>已退出学生（{summary.historicalStudents.length}）</summary>
          {summary.historicalStudents.map((student) => (
            <div className="course-student-row" key={student.id}>
              <button className="student-name-button" type="button" onClick={() => onOpenStudent(student.id)}>{student.name}</button><span>已退出</span>
              <button className="link-button" type="button" disabled={busy || summary.ended} onClick={() => void onAction(
                async () => {
                  await window.teacherWorkbench.core.reactivateCourseStudentLink({
                    courseId: summary.course.id,
                    studentId: student.id,
                  })
                },
                '学生已重新加入课程；旧点名快照未改变。',
              )}>重新加入</button>
            </div>
          ))}
        </details>
      )}
    </div>
  )
}

function CreatePeriodModal({ summary, busy, onClose, onAction }: {
  readonly summary: CourseSummary
  readonly busy: boolean
  readonly onClose: () => void
  readonly onAction: (action: () => Promise<void>, successMessage: string) => Promise<boolean>
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const success = await onAction(async () => {
      await window.teacherWorkbench.core.createPeriod({ courseId: summary.course.id, title })
    }, '阶段已创建。')
    if (success) onClose()
  }
  return (
    <Modal title="新建阶段" description={summary.course.title} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => void submit(event)}>
        <label className="modal-field">阶段名称 *<input autoFocus value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder="例如：2026 秋季" /></label>
        <footer className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={busy || title.trim() === ''}>创建阶段</button></footer>
      </form>
    </Modal>
  )
}

function CreateLessonModal({ summary, periodId, busy, onViewLesson, onClose, onAction }: {
  readonly summary: CourseSummary
  readonly periodId: string
  readonly busy: boolean
  readonly onViewLesson: (lessonId: string) => void
  readonly onClose: () => void
  readonly onAction: (action: () => Promise<void>, successMessage: string) => Promise<boolean>
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const period = summary.periods.find((candidate) => candidate.id === periodId)
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const success = await onAction(async () => {
      const lesson = await window.teacherWorkbench.core.createLesson({ periodId, title })
      if (summary.progress === null && summary.lessons.length === 0) {
        await window.teacherWorkbench.core.startPeriod({
          courseId: summary.course.id,
          periodId,
          initialLessonId: lesson.id,
        })
      }
      onViewLesson(lesson.id)
    }, summary.progress === null && summary.lessons.length === 0
      ? '第一课已创建并设为 Current Lesson。'
      : '课次已创建；Current Lesson 未自动改变。')
    if (success) onClose()
  }
  return (
    <Modal title="新建课次" description={`${summary.course.title} · ${period?.title ?? ''}`} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => void submit(event)}>
        <label className="modal-field">课次名称 *<input autoFocus value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder="例如：有理数混合运算" /></label>
        <footer className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={busy || title.trim() === ''}>创建课次</button></footer>
      </form>
    </Modal>
  )
}

function ScheduleLessonModal({ overview, lessonId, busy, onClose, onAction }: {
  readonly overview: CoreOverview
  readonly lessonId: string
  readonly busy: boolean
  readonly onClose: () => void
  readonly onAction: (action: () => Promise<void>, successMessage: string) => Promise<boolean>
}): React.JSX.Element {
  const session = overview.lessonSessions.find((candidate) => candidate.lessonId === lessonId)
  const lesson = overview.nodes.find((candidate) => candidate.id === lessonId)
  const [value, setValue] = useState(toDateTimeLocalValue(session?.scheduledAt ?? null))
  const [durationText, setDurationText] = useState(session?.durationMinutes?.toString() ?? '')
  const duration = durationText.trim() === '' ? null : Number(durationText)
  const durationValid = duration === null || (Number.isInteger(duration) && duration > 0)
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!durationValid) return
    const scheduledAt = localDateTimeToUtc(value)
    const success = await onAction(async () => {
      await window.teacherWorkbench.attendance.updateSchedule({ lessonId, scheduledAt, durationMinutes: duration })
    }, scheduledAt === null
      ? duration === null ? '已清除上课时间和课程时长。' : '已清除上课时间，课程时长已保留。'
      : '上课时间和课程时长已按本地设置保存。')
    if (success) onClose()
  }
  return (
    <Modal title="设置上课时间" description={lesson?.title} onClose={onClose}>
      <form className="modal-form" onSubmit={(event) => void submit(event)}>
        <label className="modal-field">Windows 本地日期与时间<input type="datetime-local" value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} /></label>
        <label className="modal-field">课程时长（分钟，可选）<input type="number" min="1" step="1" value={durationText} disabled={busy} onChange={(event) => setDurationText(event.target.value)} placeholder="例如 90" /></label>
        {!durationValid && <p className="inline-error" role="alert">课程时长必须是正整数分钟。</p>}
        <p className="modal-hint">保存时转换为 UTC ISO 8601；清除时间不会自动清除课程时长。</p>
        <footer className="modal-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => setValue('')}>清除时间</button><button className="secondary-button" type="button" disabled={busy} onClick={() => setDurationText('')}>清除时长</button><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit" disabled={busy || !durationValid}>保存</button></footer>
      </form>
    </Modal>
  )
}

function ProgressModal({ overview, summary, viewedLessonId, busy, onClose, onAction }: {
  readonly overview: CoreOverview
  readonly summary: CourseSummary
  readonly viewedLessonId: string
  readonly busy: boolean
  readonly onClose: () => void
  readonly onAction: (action: () => Promise<void>, successMessage: string) => Promise<boolean>
}): React.JSX.Element {
  const validLessons = listValidCurrentLessons(overview, summary)
  const initial = validLessons.find((lesson) => lesson.id === viewedLessonId)?.id ?? summary.currentLesson?.id ?? validLessons[0]?.id ?? 'clear'
  const [choice, setChoice] = useState(initial)
  async function apply(): Promise<void> {
    const success = await onAction(async () => {
      if (choice === 'clear') {
        await window.teacherWorkbench.core.clearCurrentLesson({
          courseId: summary.course.id,
          expectedCurrentLessonId: summary.progress?.currentLessonId ?? null,
        })
        return
      }
      const lesson = validLessons.find((candidate) => candidate.id === choice)
      if (lesson?.parentId === null || lesson === undefined) throw new Error('所选课次无效。')
      if (summary.progress?.activePeriodId === lesson.parentId) {
        await window.teacherWorkbench.core.setCurrentLesson({
          courseId: summary.course.id,
          lessonId: lesson.id,
          expectedCurrentLessonId: summary.progress.currentLessonId,
        })
      } else {
        await window.teacherWorkbench.core.startPeriod({
          courseId: summary.course.id,
          periodId: lesson.parentId,
          initialLessonId: lesson.id,
        })
      }
    }, choice === 'clear' ? 'Current Lesson 已清空，课程保持活动。' : 'Current Lesson 已按老师选择更新。')
    if (success) onClose()
  }
  return (
    <Modal title="调整当前课次" description="选择其他阶段时会明确开始该阶段；不会按编号自动推进。" onClose={onClose}>
      <label className="modal-field">下一次默认处理<select value={choice} disabled={busy} onChange={(event) => setChoice(event.target.value)}>
        <option value="clear">暂不设置下一课</option>
        {validLessons.map((lesson) => {
          const period = summary.periods.find((candidate) => candidate.id === lesson.parentId)
          const number = lesson.parentId === null ? 0 : getLessonNumber(summary.lessons, lesson.parentId, lesson.id)
          return <option key={lesson.id} value={lesson.id}>{period?.title} · {lesson.lessonLabel ?? `第 ${number} 课`} {lesson.title}</option>
        })}
      </select></label>
      <footer className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="button" disabled={busy} onClick={() => void apply()}>保存选择</button></footer>
    </Modal>
  )
}

function heroStudentLine(summary: CourseSummary): string {
  if (summary.course.courseMode === 'one_to_one') {
    return summary.activeStudents.length === 0 ? '未关联学生' : summary.activeStudents[0]!.name
  }
  return `在读 ${summary.activeStudents.length} 人`
}

/** 行动卡「上节反馈」chip 的主角：主角课次之前最近一节已上过的课次（无则不显示 chip）。 */
function previousTaughtLesson(
  overview: CoreOverview,
  summary: CourseSummary,
  heroLessonId: string | null,
): NodeRecord | null {
  const taught = new Set(overview.lessonSessions
    .filter((session) => session.taughtConfirmedAt !== null)
    .map((session) => session.lessonId))
  const heroIndex = heroLessonId === null
    ? summary.lessons.length
    : summary.lessons.findIndex((lesson) => lesson.id === heroLessonId)
  for (let index = (heroIndex === -1 ? summary.lessons.length : heroIndex) - 1; index >= 0; index -= 1) {
    const lesson = summary.lessons[index]!
    if (taught.has(lesson.id)) return lesson
  }
  return null
}

function formatSessionSchedule(session: LessonSessionSummary | undefined): string {
  if (session === undefined) return '未排时间'
  if (session.scheduledOn !== undefined) {
    return `${formatLocalDateOnly(session.scheduledOn)} · ${session.scheduledAt === null ? '时间未记录' : formatLocalDateTime(session.scheduledAt)}`
  }
  return formatLocalDateTime(session.scheduledAt)
}

function latestLessonDraft(overview: CoreOverview, lessonId: string): NoteRecord | null {
  return overview.notes
    .filter((note) =>
      note.lessonId === lessonId &&
      note.deletedAt === null &&
      note.draftStatus === 'draft',
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
}
