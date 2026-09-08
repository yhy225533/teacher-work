import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** V19-C（D58）：课程页当前课次行动卡——静态名片降为 crumb，全局入口收进 ⋯"全局"组（结构钉测）。 */
describe('V19-C 课程页当前课次行动头', () => {
  it('retires the course-page-header stats strip; minimal head only when no course is selected', () => {
    const dashboard = source('../src/renderer/course-dashboard.tsx')
    const detail = source('../src/renderer/course-detail.tsx')
    // 统计条退役：不再渲染 course-page-header / 全部课程统计行
    // 只断言 JSX 结构退役（注释/说明允许保留字面量）
    expect(dashboard).not.toContain('<header className="course-page-header">')
    expect(dashboard).not.toContain('course-page-stats')
    expect(dashboard).not.toContain('全部课程 {summaries.length}')
    // 未选课程（selectedSummary === null）时保留最小页头：刷新 + 仅创建课程 + 快速建课
    expect(dashboard).toContain('selectedSummary === null')
    expect(dashboard).toContain('course-minimal-head')
    expect(dashboard).toContain('仅创建课程')
    expect(dashboard).toContain('+ 快速建课')
    // 空态面板补建课入口（与最小页头一致的行为）
    expect(detail).toContain('course-empty-actions')
  })

  it('renders the hero card structure: crumb + title with badges + chips + primary actions', () => {
    const detail = source('../src/renderer/course-detail.tsx')
    const heroCard = detail.slice(detail.indexOf('<header className="lesson-hero-card">'), detail.indexOf('<nav className="course-detail-tabs"'))
    // crumb：课程 · 一对一/班课 · 阶段 · 共 N 课（第 M 课）
    expect(heroCard).toContain('lesson-hero-crumb')
    expect(heroCard).toContain("summary.course.courseMode === 'one_to_one' ? '一对一' : '班课'")
    expect(heroCard).toContain('共 {summary.lessons.length} 课')
    expect(heroCard).toContain("heroNumber === null ? '' : `（第 ${heroNumber} 课）`")
    // 大字：当前课次标题 + Current/已上/已结束徽标
    expect(heroCard).toContain('lesson-hero-title')
    expect(heroCard).toContain('<em className="is-current">Current</em>')
    expect(heroCard).toContain('<em>已上</em>')
    expect(heroCard).toContain('<em>已结束</em>')
    // chips 五项：排课时间 / 学员 / 讲义 N / 材料 N / 上节反馈
    expect(heroCard).toContain('lesson-hero-chips')
    expect(heroCard).toContain('🕘 {formatSessionSchedule(heroSession)}')
    expect(heroCard).toContain('👤 {heroStudentLine(summary)}')
    expect(heroCard).toContain('📘 讲义 {heroFilesByRole.lecture.length}')
    expect(heroCard).toContain('📎 材料 {heroFilesByRole.materials.length}')
    expect(heroCard).toContain('{heroFeedbackChip}')
    expect(detail).toContain('hero-chip is-feedback-done')
    // 行动键：进入教学内容 primary / 点名 / 确认本课已上 / ⋯
    expect(heroCard).toContain('▶ 进入教学内容')
    expect(heroCard).toContain("heroSession?.attendanceRecordedAt == null ? '点名' : '修改点名'")
    expect(heroCard).toContain('确认本课已上')
    expect(heroCard).toContain('<AppMenuButton label="⋯"')
  })

  it('derives chips from existing overview data only: file counts via splitLessonFilesByRole, no new IPC', () => {
    const detail = source('../src/renderer/course-detail.tsx')
    // 讲义/材料计数走既有 files:get-overview + listLessonPrepFiles + splitLessonFilesByRole
    expect(detail).toContain('window.teacherWorkbench.files.getOverview()')
    expect(detail).toContain('window.teacherWorkbench.files.onContentChanged')
    expect(detail).toContain('splitLessonFilesByRole(listLessonPrepFiles(filesOverview, hero.id))')
    // 学员 chip：一对一显示学生名，班课显示在读 N 人
    expect(detail).toContain('summary.activeStudents[0]!.name')
    expect(detail).toContain('return `在读 ${summary.activeStudents.length} 人`')
    // 上节反馈 chip：主角课次之前最近一节已上过的课次；无在读学生不显示
    expect(detail).toContain('previousTaughtLesson(')
    expect(detail).toContain('feedback.complete')
    expect(detail).toContain('上节反馈 {feedback.complete ? \'✓\' : \'✍ 待补写\'}')
    // 渲染层零新增通道：行动卡主组件段的 files 通道只有 getOverview/onContentChanged；core 调用仅为
    // 从退役名片原样搬迁的冻结生命周期动作（结束/重新开启/撤销已上——v1.2 既有语义，零新增通道）。
    const heroBlock = detail.slice(0, detail.indexOf('function LessonsSection'))
    const calls = [...heroBlock.matchAll(/window\.teacherWorkbench\.([a-z]+)\.([A-Za-z]+)/g)].map((m) => `${m[1]}.${m[2]}`)
    expect(new Set(calls)).toEqual(new Set([
      'files.getOverview', 'files.onContentChanged',
      'core.endCourse', 'core.reopenCourse',
    ]))
    // 撤销本课已上留在 Viewed Lesson 卡（V1.8 冻结语义，不进行动卡）
    expect(detail.slice(detail.indexOf('function LessonsSection')).indexOf('undoLessonTaught')).toBeGreaterThan(-1)
    expect(heroBlock.match(/window\.teacherWorkbench\.files\.(?!getOverview|onContentChanged)[A-Za-z]+/g)).toBe(null)
  })

  it('hero = Viewed Lesson with Current Lesson fallback; chips and actions follow the hero', () => {
    const detail = source('../src/renderer/course-detail.tsx')
    const heroCard = detail.slice(detail.indexOf('<header className="lesson-hero-card">'), detail.indexOf('<nav className="course-detail-tabs"'))
    expect(detail).toContain('const hero = viewedLesson ?? summary.currentLesson')
    // 进入教学内容/点名/确认已上都指向主角课次
    expect(detail).toContain('onOpenAttendance(hero.id)')
    expect(detail).toContain('onConfirmTaught(hero.id)')
    expect(detail).toContain('setScheduleLessonId(hero.id)')
    // primary 按钮跳转教学内容（不移动 Current Lesson，语义与 V1.5 冻结一致）
    expect(detail).toContain("onOpenTeachingContent(createLessonPrepContext(summary.course, hero, summary.activeStudents, heroPeriod?.title))")
    // primary 按钮不走 setCurrentLesson（ProgressModal 里的调整当前课次为既有冻结流程，保留）
    expect(detail).not.toContain('onOpenTeachingContent(createLessonPrepContext(summary.course, hero, summary.activeStudents, heroPeriod?.title)).then')
    expect(heroCard).not.toContain('setCurrentLesson')
  })

  it('groups the overflow menu into 本课 / 本课程 / 全局 with the danger zone at the bottom', () => {
    const detail = source('../src/renderer/course-detail.tsx')
    // 活动课程菜单：本课（调整当前课次/设置时间）→ 本课程（学生名单/修改记录）→ 全局（统计/建课/刷新）→ 红区（结束课程）
    const activeEntries = detail.slice(detail.indexOf('const heroMenuEntries: AppMenuEntry[] ='), detail.indexOf('return (\n    <section className="course-detail-pane"'))
    expect(activeEntries).toContain("'本课'")
    expect(activeEntries).toContain("'调整当前课次'")
    expect(activeEntries).toContain("'设置时间'")
    expect(activeEntries).toContain("'本课程'")
    expect(activeEntries).toContain("'学生名单'")
    expect(activeEntries).toContain('label: `修改记录 ${draftCount}`')
    expect(activeEntries).toContain("'全局'")
    expect(activeEntries).toContain('全部课程 ${courseCount}')
    expect(activeEntries).toContain("'+ 快速建课'")
    expect(activeEntries).toContain("'+ 仅创建课程'")
    expect(activeEntries).toContain("'刷新'")
    // 红区在最后：危险分隔线 → 结束课程（danger）是最后一条
    expect(activeEntries).toContain("'结束课程', danger: true")
    expect(activeEntries.lastIndexOf('danger: true')).toBeGreaterThan(activeEntries.lastIndexOf('separator'))
    expect(activeEntries.trim().endsWith('} },') || activeEntries.includes("'结束课程', danger: true, disabled: busy")).toBe(true)
    // 已结束课程：仅本课程/全局组，红区为重新开启课程
    expect(activeEntries).toContain("'重新开启课程', danger: true")
  })

  it('keeps frozen flows untouched: attendance strip, lesson table, Viewed Lesson panel, tabs', () => {
    const dashboard = source('../src/renderer/course-dashboard.tsx')
    const detail = source('../src/renderer/course-detail.tsx')
    // 今日待点名条、课次表（LessonsSection）与 Viewed Lesson 卡保留，与行动卡共用 handler
    expect(dashboard).toContain('今日待点名')
    expect(detail).toContain('Viewed Lesson')
    expect(detail).toContain("'lessons', '课次'")
    expect(detail).toContain("'students', '学生'")
    // V1.8 反馈链零回归：课次行徽标 + Viewed 反馈块
    expect(detail).toContain('<em>已反馈</em>')
    expect(detail).toContain('<em className="is-missing">缺反馈</em>')
    expect(detail).toContain('feedback-summary-line')
    // 快速建课入口行为不变（收进 ⋯/最小页头，仍打开同一 wizard）
    expect(dashboard).toContain('setQuickCourseOpen(true)')
    expect(dashboard).toContain('进入第 1 课备课')
  })

  it('styles: hero card / chips / minimal head present; retired name-card selectors removed', () => {
    const styles = source('../src/renderer/styles.css')
    expect(styles).toContain('.lesson-hero-card')
    expect(styles).toContain('.lesson-hero-crumb')
    expect(styles).toContain('.lesson-hero-title')
    expect(styles).toContain('.lesson-hero-chips')
    expect(styles).toContain('.hero-chip')
    expect(styles).toContain('.course-minimal-head')
    // 静态名片选择器退役
    expect(styles).not.toContain('.course-page-header {')
    expect(styles).not.toContain('.course-detail-header')
    expect(styles).not.toContain('.course-detail-actions')
    expect(styles).not.toContain('.course-detail-mode')
    // 1100px 断点改为行动卡堆叠
    expect(styles).toContain('.lesson-hero-card,\n  .viewed-lesson-panel { flex-direction: column; }')
  })
})
