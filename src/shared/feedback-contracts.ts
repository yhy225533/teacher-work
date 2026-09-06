import { isRecord } from './ipc-contracts'

/** D43：转写文本上限（超出头截 + truncated 标注）。 */
export const FEEDBACK_TRANSCRIPT_MAX_CHARS = 30_000

/** D43：反馈整理输出 token 上限（费用量级与一次小生成相当）。 */
export const FEEDBACK_MAX_TOKENS = 1_500

/** D44：内置默认提示词固定版本（不选 Skill 时兜底三段结构）。 */
export const FEEDBACK_PROMPT_VERSION = 'v18-01-v1'

/** 反馈正文上限（textarea maxLength）。 */
export const FEEDBACK_BODY_MAX_CHARS = 8_000

export interface TranscriptResult {
  readonly fileName: string
  readonly text: string
  readonly chars: number
  readonly truncated: boolean
}

export interface GenerateFeedbackRequest {
  readonly lessonId: string
  readonly studentId: string
  readonly transcriptText: string
  readonly skillId?: string
}

export interface GeneratedFeedback {
  readonly draftText: string
  readonly model: string
  readonly promptVersion: string
  readonly inputChars: number
}

/**
 * D40：AI 整理反馈的 ai_metadata_json 合同（轻量字段集，不与 DraftNoteMetadata 混用）；
 * 手写保存的反馈不写 aiMetadata。
 */
export interface FeedbackNoteMetadata {
  readonly generatedBy: 'feedback-assistant'
  readonly promptVersion: string
  readonly provider: string
  readonly model: string
  readonly skill?: { readonly id: string; readonly name: string; readonly prompt: string }
  readonly transcriptChars: number
}

export function isTranscriptResult(value: unknown): value is TranscriptResult {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['fileName', 'text', 'chars', 'truncated']) &&
    isNonEmptyString(value.fileName) &&
    typeof value.text === 'string' &&
    value.text.length > 0 &&
    typeof value.chars === 'number' &&
    Number.isInteger(value.chars) &&
    value.chars >= 0 &&
    value.chars <= FEEDBACK_TRANSCRIPT_MAX_CHARS &&
    typeof value.truncated === 'boolean'
  )
}

export function isGenerateFeedbackRequest(value: unknown): value is GenerateFeedbackRequest {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['lessonId', 'studentId', 'transcriptText'], ['skillId']) &&
    isNonEmptyString(value.lessonId) &&
    isNonEmptyString(value.studentId) &&
    typeof value.transcriptText === 'string' &&
    value.transcriptText.trim().length > 0 &&
    value.transcriptText.length <= FEEDBACK_TRANSCRIPT_MAX_CHARS &&
    (value.skillId === undefined || isNonEmptyString(value.skillId))
  )
}

export function isGeneratedFeedback(value: unknown): value is GeneratedFeedback {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['draftText', 'model', 'promptVersion', 'inputChars']) &&
    typeof value.draftText === 'string' &&
    value.draftText.trim().length > 0 &&
    value.draftText.length <= FEEDBACK_BODY_MAX_CHARS &&
    isNonEmptyString(value.model) &&
    isNonEmptyString(value.promptVersion) &&
    typeof value.inputChars === 'number' &&
    Number.isInteger(value.inputChars) &&
    value.inputChars >= 0 &&
    value.inputChars <= FEEDBACK_TRANSCRIPT_MAX_CHARS
  )
}

export function isFeedbackNoteMetadata(value: unknown): value is FeedbackNoteMetadata {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ['generatedBy', 'promptVersion', 'provider', 'model', 'transcriptChars'], ['skill']) &&
    value.generatedBy === 'feedback-assistant' &&
    isNonEmptyString(value.promptVersion) &&
    isNonEmptyString(value.provider) &&
    isNonEmptyString(value.model) &&
    (value.skill === undefined || (
      isRecord(value.skill) &&
      hasOnlyKeys(value.skill, ['id', 'name', 'prompt']) &&
      isNonEmptyString(value.skill.id) &&
      isNonEmptyString(value.skill.name) &&
      isNonEmptyString(value.skill.prompt)
    )) &&
    typeof value.transcriptChars === 'number' &&
    Number.isInteger(value.transcriptChars) &&
    value.transcriptChars >= 0 &&
    value.transcriptChars <= FEEDBACK_TRANSCRIPT_MAX_CHARS
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): boolean {
  const allowed = new Set([...requiredKeys, ...optionalKeys])
  const keys = Object.keys(value)
  return requiredKeys.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key))
}
