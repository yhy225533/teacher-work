import { basename } from 'node:path'
import { readFile } from 'node:fs/promises'

import {
  FEEDBACK_MAX_TOKENS,
  FEEDBACK_PROMPT_VERSION,
  FEEDBACK_TRANSCRIPT_MAX_CHARS,
  type GeneratedFeedback,
  type GenerateFeedbackRequest,
  type TranscriptResult,
} from '../../shared/feedback-contracts'
import { AiGateway, AiGatewayError } from '../ai/ai-gateway'
import type { CoreDataService } from '../data/core-data-service'
import { CoreDataError } from '../data/core-data-service'
import { SkillServiceError, type SkillService } from '../skills/skill-service'

export type FeedbackServiceErrorCode =
  | 'FEEDBACK_TRANSCRIPT_UNREADABLE'
  | 'FEEDBACK_LESSON_INVALID'
  | 'FEEDBACK_STUDENT_INVALID'
  | 'FEEDBACK_TRANSCRIPT_EMPTY'

export class FeedbackServiceError extends Error {
  readonly code: FeedbackServiceErrorCode

  constructor(code: FeedbackServiceErrorCode, message: string) {
    super(message)
    this.name = 'FeedbackServiceError'
    this.code = code
  }
}

/** D43：系统对话框选中的单个 .txt/.md 路径（取消返回 null）；由 index.ts 注入避免测试依赖 Electron。 */
export type TranscriptPicker = () => Promise<string | null>

/** D44：内置默认三段结构提示词（FEEDBACK_PROMPT_VERSION 固定版本兜底）。 */
export const FEEDBACK_DEFAULT_PROMPT = `你是一位严谨的 1 对 1 /小班老师。请根据课堂录音转写文字，为指定学生整理一条课后反馈草稿。
要求：
1. 使用中文，语气自然、面向家长可读，不虚构转写中不存在的内容；
2. 按三段结构组织（可加小标题）：课堂内容 / 掌握情况 / 作业与下节安排；
3. 只输出反馈正文本身，不要额外解释或寒暄。`

export interface FeedbackServiceDependencies {
  readonly coreData: CoreDataService
  readonly skills: SkillService
  readonly aiGateway: AiGateway
  readonly chooseTranscript: TranscriptPicker
}

export class FeedbackService {
  constructor(private readonly dependencies: FeedbackServiceDependencies) {}

  /**
   * D43：选文件 → UTF-8 读文本 → 头截 + truncated；不写 files 表、不复制进受控目录、
   * 不进搜索索引、正文不进日志，材料用完即弃。
   */
  async readTranscript(): Promise<TranscriptResult | null> {
    const sourcePath = await this.dependencies.chooseTranscript()
    if (sourcePath === null) return null
    let raw: string
    try {
      raw = await readFile(sourcePath, 'utf8')
    } catch {
      throw new FeedbackServiceError('FEEDBACK_TRANSCRIPT_UNREADABLE', '无法读取所选转写文件。')
    }
    const text = raw.length > FEEDBACK_TRANSCRIPT_MAX_CHARS
      ? raw.slice(0, FEEDBACK_TRANSCRIPT_MAX_CHARS)
      : raw
    if (text.trim() === '') {
      throw new FeedbackServiceError('FEEDBACK_TRANSCRIPT_EMPTY', '所选转写文件没有可读文本。')
    }
    return {
      fileName: basename(sourcePath),
      text,
      chars: text.length,
      truncated: raw.length > FEEDBACK_TRANSCRIPT_MAX_CHARS,
    }
  }

  /**
   * D44：skill.prompt 或内置默认提示词 + 学生/课程/课次/反馈日期上下文 + 转写文本 →
   * 非流式生成草稿；不落库（保存时才由 Renderer 走 core:create-note / core:update-note）。
   */
  async generate(request: GenerateFeedbackRequest): Promise<GeneratedFeedback> {
    const context = this.resolveLessonContext(request.lessonId, request.studentId)
    const skill = request.skillId === undefined
      ? undefined
      : this.resolveSkill(request.skillId)
    const prompt = buildFeedbackPrompt({
      skillPrompt: skill?.prompt,
      studentName: context.studentName,
      courseTitle: context.courseTitle,
      lessonTitle: context.lessonTitle,
      feedbackDate: context.feedbackDate,
      transcriptText: request.transcriptText,
    })
    const result = await this.dependencies.aiGateway.requestText(
      `feedback-${request.lessonId}-${request.studentId}`,
      prompt,
      FEEDBACK_MAX_TOKENS,
    )
    return {
      draftText: result.text,
      model: result.model,
      promptVersion: skill === undefined ? FEEDBACK_PROMPT_VERSION : `${FEEDBACK_PROMPT_VERSION}+skill`,
      inputChars: request.transcriptText.length,
    }
  }

  /**
   * 反馈日期展示/提交值（D40）：排程日期 ?? 当天本地日期。
   * 排程的本地日历日期从 lesson_sessions.scheduled_at（本地上课时间的 UTC 瞬时值）取本地日期部分；
   * scheduled_on 列目前没有写入方，仅为历史导入预留。
   */
  resolveFeedbackDate(lessonId: string, now = new Date()): string {
    const session = this.dependencies.coreData.progress.listLessonSessions()
      .find((candidate) => candidate.lessonId === lessonId)
    const anchor = session?.scheduledAt === null || session === undefined || session.scheduledAt === null
      ? now
      : new Date(session.scheduledAt)
    const pad = (part: number): string => part.toString().padStart(2, '0')
    return Number.isNaN(anchor.getTime())
      ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      : `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`
  }

  private resolveLessonContext(lessonId: string, studentId: string): {
    readonly studentName: string
    readonly courseTitle: string
    readonly lessonTitle: string
    readonly feedbackDate: string
  } {
    try {
      const lesson = this.dependencies.coreData.getDraftLessonSnapshot(lessonId, studentId)
      if (lesson.studentName === undefined) {
        throw new FeedbackServiceError('FEEDBACK_STUDENT_INVALID', '所选学生不属于当前课次的课程。')
      }
      return {
        studentName: lesson.studentName,
        courseTitle: lesson.courseTitle,
        lessonTitle: lesson.lessonTitle,
        feedbackDate: this.resolveFeedbackDate(lessonId),
      }
    } catch (error) {
      if (error instanceof FeedbackServiceError) throw error
      if (error instanceof CoreDataError) {
        throw new FeedbackServiceError('FEEDBACK_LESSON_INVALID', error.message)
      }
      throw error
    }
  }

  private resolveSkill(skillId: string) {
    try {
      return this.dependencies.skills.getActiveSkill(skillId)
    } catch (error) {
      if (error instanceof SkillServiceError) {
        throw new FeedbackServiceError('FEEDBACK_LESSON_INVALID', error.message)
      }
      throw error
    }
  }
}

function buildFeedbackPrompt(input: {
  readonly skillPrompt: string | undefined
  readonly studentName: string
  readonly courseTitle: string
  readonly lessonTitle: string
  readonly feedbackDate: string
  readonly transcriptText: string
}): string {
  const instruction = input.skillPrompt === undefined
    ? FEEDBACK_DEFAULT_PROMPT
    : input.skillPrompt
  return [
    instruction,
    '',
    '【本课上下文】',
    `学生：${input.studentName}`,
    `课程：${input.courseTitle}`,
    `课次：${input.lessonTitle}`,
    `反馈日期：${input.feedbackDate}`,
    '',
    '【课堂录音转写文字】',
    input.transcriptText,
  ].join('\n')
}

export { AiGatewayError }
