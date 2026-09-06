import { describe, expect, it } from 'vitest'

import {
  FEEDBACK_BODY_MAX_CHARS,
  FEEDBACK_MAX_TOKENS,
  FEEDBACK_PROMPT_VERSION,
  FEEDBACK_TRANSCRIPT_MAX_CHARS,
  isFeedbackNoteMetadata,
  isGenerateFeedbackRequest,
  isGeneratedFeedback,
  isTranscriptResult,
  type FeedbackNoteMetadata,
  type GeneratedFeedback,
  type GenerateFeedbackRequest,
  type TranscriptResult,
} from '../src/shared/feedback-contracts'
import { isNoteRecord } from '../src/shared/core-contracts'

describe('V18-A feedback contracts', () => {
  it('pins the D43/D44 constants', () => {
    expect(FEEDBACK_TRANSCRIPT_MAX_CHARS).toBe(30_000)
    expect(FEEDBACK_MAX_TOKENS).toBe(1_500)
    expect(FEEDBACK_PROMPT_VERSION).toBe('v18-01-v1')
    expect(FEEDBACK_BODY_MAX_CHARS).toBe(8_000)
  })

  it('isTranscriptResult: accepts valid and rejects malformed payloads', () => {
    const valid: TranscriptResult = {
      fileName: '课堂转写.txt',
      text: '今天讲了有理数',
      chars: 7,
      truncated: false,
    }
    expect(isTranscriptResult(valid)).toBe(true)
    expect(isTranscriptResult({ ...valid, truncated: true })).toBe(true)
    // 截断后 chars 不可能超上限——超限值拒收
    expect(isTranscriptResult({ ...valid, chars: FEEDBACK_TRANSCRIPT_MAX_CHARS + 1 })).toBe(false)
    expect(isTranscriptResult({ ...valid, text: '' })).toBe(false)
    expect(isTranscriptResult({ ...valid, extra: 1 })).toBe(false)
    expect(isTranscriptResult('not-a-record')).toBe(false)
  })

  it('isGenerateFeedbackRequest: skillId optional, transcript bounded non-empty', () => {
    const base: GenerateFeedbackRequest = {
      lessonId: 'lesson-1',
      studentId: 'student-1',
      transcriptText: '转写内容',
    }
    expect(isGenerateFeedbackRequest(base)).toBe(true)
    expect(isGenerateFeedbackRequest({ ...base, skillId: 'skill-1' })).toBe(true)
    expect(isGenerateFeedbackRequest({ ...base, skillId: '' })).toBe(false)
    expect(isGenerateFeedbackRequest({ ...base, transcriptText: '   ' })).toBe(false)
    expect(
      isGenerateFeedbackRequest({ ...base, transcriptText: 'x'.repeat(FEEDBACK_TRANSCRIPT_MAX_CHARS + 1) }),
    ).toBe(false)
    expect(isGenerateFeedbackRequest({ lessonId: 'l', studentId: 's' })).toBe(false)
  })

  it('isGeneratedFeedback: draft non-empty within body cap', () => {
    const valid: GeneratedFeedback = {
      draftText: '【课堂内容】…',
      model: 'deepseek-chat',
      promptVersion: FEEDBACK_PROMPT_VERSION,
      inputChars: 2_400,
    }
    expect(isGeneratedFeedback(valid)).toBe(true)
    expect(isGeneratedFeedback({ ...valid, draftText: ' ' })).toBe(false)
    expect(
      isGeneratedFeedback({ ...valid, draftText: 'x'.repeat(FEEDBACK_BODY_MAX_CHARS + 1) }),
    ).toBe(false)
    expect(isGeneratedFeedback({ ...valid, inputChars: FEEDBACK_TRANSCRIPT_MAX_CHARS + 1 })).toBe(false)
    expect(isGeneratedFeedback({ ...valid, promptVersion: '' })).toBe(false)
  })

  it('isFeedbackNoteMetadata: light schema with optional skill snapshot', () => {
    const base: FeedbackNoteMetadata = {
      generatedBy: 'feedback-assistant',
      promptVersion: FEEDBACK_PROMPT_VERSION,
      provider: 'openai-compatible',
      model: 'deepseek-chat',
      transcriptChars: 2_400,
    }
    expect(isFeedbackNoteMetadata(base)).toBe(true)
    expect(isFeedbackNoteMetadata({
      ...base,
      skill: { id: 'skill-1', name: '数学 · 课后反馈', prompt: '按三段结构写' },
    })).toBe(true)
    expect(isFeedbackNoteMetadata({ ...base, generatedBy: 'draft' })).toBe(false)
    expect(isFeedbackNoteMetadata({ ...base, skill: { id: 's', name: 'n', prompt: '' } })).toBe(false)
    expect(isFeedbackNoteMetadata({ ...base, transcriptChars: -1 })).toBe(false)
    expect(isFeedbackNoteMetadata({ ...base, sources: [] })).toBe(false)
  })

  it('isNoteRecord accepts a manual note with FeedbackNoteMetadata (D40 dual contract)', () => {
    const note = {
      id: 'note-1',
      studentId: 'student-1',
      lessonId: 'lesson-1',
      bodyMd: '本课反馈内容',
      createdAt: '2026-09-06T00:00:00.000Z',
      updatedAt: '2026-09-06T00:00:00.000Z',
      deletedAt: null,
      occurredOn: '2026-09-05',
      aiMetadata: {
        generatedBy: 'feedback-assistant',
        promptVersion: FEEDBACK_PROMPT_VERSION,
        provider: 'openai-compatible',
        model: 'deepseek-chat',
        skill: { id: 'skill-1', name: '反馈 Skill', prompt: '整理成三段' },
        transcriptChars: 1_800,
      },
    }
    expect(isNoteRecord(note)).toBe(true)
    // draft 类 aiMetadata（有 draftStatus 联动校验）与反馈类互不串台：反馈类不携带 draftStatus
    expect(isNoteRecord({ ...note, draftStatus: 'draft' })).toBe(false)
  })
})
