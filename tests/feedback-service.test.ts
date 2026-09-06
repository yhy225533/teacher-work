import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AiGateway, type AiFetch, type AiFetchResponse } from '../src/main/ai/ai-gateway'
import { AiSettingsService } from '../src/main/ai/ai-settings-service'
import type { SecureStoragePort } from '../src/main/ai/secure-storage'
import { CoreDataService } from '../src/main/data/core-data-service'
import { runMigrations } from '../src/main/db/migrations'
import {
  FEEDBACK_DEFAULT_PROMPT,
  FeedbackService,
} from '../src/main/feedback/feedback-service'
import { SkillService } from '../src/main/skills/skill-service'
import {
  FEEDBACK_MAX_TOKENS,
  FEEDBACK_TRANSCRIPT_MAX_CHARS,
  type TranscriptResult,
} from '../src/shared/feedback-contracts'
import Database from 'better-sqlite3'

const fixtureDirs: string[] = []
afterEach(() => {
  for (const dir of fixtureDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

class MemoryStorage implements SecureStoragePort {
  isAvailable(): boolean { return false }
  encrypt(value: string): Buffer { return Buffer.from(value) }
  decrypt(value: Buffer): string { return value.toString() }
  read(): Buffer | undefined { return undefined }
  write(): void { /* session key path only in tests */ }
  clear(): void { /* nothing persisted */ }
}

interface FakeGatewayScript {
  readonly reply: string
}

function fixture(scripts: readonly FakeGatewayScript[]) {
  const database = new Database(':memory:')
  database.pragma('foreign_keys = ON')
  runMigrations(database)
  const core = new CoreDataService(database)
  const skills = new SkillService(database)
  const course = core.nodes.createCourse('V18 反馈课程', 'one_to_one')
  const period = core.nodes.createPeriod(course.id, '第一阶段')
  const lesson = core.nodes.createLesson(period.id, '有理数运算')
  const student = core.createStudent('高馨云')
  core.linkStudentToCourse(course.id, student.id)

  const seen: { prompt: string; maxTokens?: number }[] = []
  const fetcher: AiFetch = async (_input, init) => {
    const body = JSON.parse(init.body) as { readonly messages: readonly { readonly content: string }[]; readonly max_tokens?: number }
    seen.push({ prompt: body.messages[0]!.content, maxTokens: body.max_tokens })
    const script = scripts[Math.min(seen.length - 1, scripts.length - 1)]!
    const response: AiFetchResponse = {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: script.reply } }], model: 'deepseek-chat' }),
      text: async () => JSON.stringify({}),
    }
    return response
  }
  const settings = new AiSettingsService(database, { secureStorage: new MemoryStorage() })
  settings.updateSettings({
    provider: 'openai-compatible',
    model: 'deepseek-chat',
    endpoint: 'https://api.example.com/v1',
    apiKey: 'test-key',
  })
  const gateway = new AiGateway(settings, { fetch: fetcher })
  const service = new FeedbackService({
    coreData: core,
    skills,
    aiGateway: gateway,
    chooseTranscript: async () => null,
  })
  return { database, core, skills, lesson, student, service, seen, course }
}

function writeTranscriptFile(name: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'v18a-transcript-'))
  fixtureDirs.push(dir)
  const path = join(dir, name)
  writeFileSync(path, body)
  return path
}

describe('V18-A feedback service', () => {
  it('injects skill prompt with lesson/student context into the gateway call', async () => {
    const skillPrompt = '请按我自定义的结构写反馈，落款「王老师」。'
    const { core, skills, lesson, student, service, seen, course } = fixture([{ reply: '反馈草稿' }])
    const skill = skills.createSkill('数学 · 课后反馈', skillPrompt)
    core.attendance.updateLessonSchedule(
      lesson.id,
      new Date('2026-07-29T10:00:00').toISOString(),
      90,
    )

    const result = await service.generate({
      lessonId: lesson.id,
      studentId: student.id,
      transcriptText: '课堂转写内容',
      skillId: skill.id,
    })

    expect(result.draftText).toBe('反馈草稿')
    expect(result.model).toBe('deepseek-chat')
    expect(result.inputChars).toBe(6)
    expect(seen[0]!.maxTokens).toBe(FEEDBACK_MAX_TOKENS)
    const prompt = seen[0]!.prompt
    expect(prompt).toContain(skillPrompt)
    expect(prompt).toContain('学生：高馨云')
    expect(prompt).toContain(`课程：${course.title}`)
    expect(prompt).toContain(`课次：${lesson.title}`)
    expect(prompt).toContain('反馈日期：2026-07-29')
    expect(prompt).toContain('课堂转写内容')
  })

  it('falls back to the default three-part prompt without a skill', async () => {
    const { lesson, student, service, seen } = fixture([{ reply: '草稿' }])
    await service.generate({
      lessonId: lesson.id,
      studentId: student.id,
      transcriptText: '转写',
    })
    expect(seen[0]!.prompt.startsWith(FEEDBACK_DEFAULT_PROMPT)).toBe(true)
  })

  it('never writes a note row: draft stays out of the notes table', async () => {
    const { core, lesson, student, service } = fixture([{ reply: 'AI 草稿' }])
    await service.generate({
      lessonId: lesson.id,
      studentId: student.id,
      transcriptText: '转写',
    })
    expect(core.getOverview().notes).toHaveLength(0)
  })

  it('reads a picked transcript, truncating over-cap files head-first', async () => {
    const database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    runMigrations(database)
    const core = new CoreDataService(database)
    const skills = new SkillService(database)
    const settings = new AiSettingsService(database, { secureStorage: new MemoryStorage() })
    const gateway = new AiGateway(settings, { fetch: async () => { throw new Error('unused') } })
    let pickedPath = writeTranscriptFile('课后转写.md', 'x'.repeat(FEEDBACK_TRANSCRIPT_MAX_CHARS + 500))
    const service = new FeedbackService({
      coreData: core,
      skills,
      aiGateway: gateway,
      chooseTranscript: async () => pickedPath,
    })

    const truncated = await service.readTranscript() as TranscriptResult
    expect(truncated.fileName).toBe('课后转写.md')
    expect(truncated.truncated).toBe(true)
    expect(truncated.chars).toBe(FEEDBACK_TRANSCRIPT_MAX_CHARS)
    expect(truncated.text.length).toBe(FEEDBACK_TRANSCRIPT_MAX_CHARS)

    pickedPath = writeTranscriptFile('小转写.txt', '短转写')
    const plain = await service.readTranscript() as TranscriptResult
    expect(plain.truncated).toBe(false)
    expect(plain.chars).toBe(3)
    // D43：不登记 files 表（内存库只有本测试造的 notes 行数 0，files 表为空）
    expect(
      (database.prepare('SELECT COUNT(*) AS count FROM files').get() as { count: number }).count,
    ).toBe(0)
  })

  it('returns null when the teacher cancels the file dialog', async () => {
    const database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    runMigrations(database)
    const service = new FeedbackService({
      coreData: new CoreDataService(database),
      skills: new SkillService(database),
      aiGateway: new AiGateway(new AiSettingsService(database, { secureStorage: new MemoryStorage() }), { fetch: async () => { throw new Error('unused') } }),
      chooseTranscript: async () => null,
    })
    expect(await service.readTranscript()).toBeNull()
  })

  it('propagates AiGateway errors unchanged (AI_NOT_CONFIGURED)', async () => {
    const database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    runMigrations(database)
    const core = new CoreDataService(database)
    const course = core.nodes.createCourse('未配置课程', 'one_to_one')
    const period = core.nodes.createPeriod(course.id, '阶段')
    const lesson = core.nodes.createLesson(period.id, '课')
    const student = core.createStudent('学生')
    core.linkStudentToCourse(course.id, student.id)
    const service = new FeedbackService({
      coreData: core,
      skills: new SkillService(database),
      aiGateway: new AiGateway(
        new AiSettingsService(database, { secureStorage: new MemoryStorage() }),
        { fetch: async () => { throw new Error('unused') } },
      ),
      chooseTranscript: async () => null,
    })
    await expect(
      service.generate({ lessonId: lesson.id, studentId: student.id, transcriptText: 'x' }),
    ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' })
  })

  it('rejects unknown students and students outside the lesson course', async () => {
    const { lesson, student, service } = fixture([{ reply: 'unused' }])
    await expect(
      service.generate({ lessonId: lesson.id, studentId: 'unknown-student', transcriptText: 'x' }),
    ).rejects.toMatchObject({ name: 'FeedbackServiceError' })

    const database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    runMigrations(database)
    const core = new CoreDataService(database)
    const course = core.nodes.createCourse('另一门课', 'one_to_one')
    const period = core.nodes.createPeriod(course.id, '阶段')
    const otherLesson = core.nodes.createLesson(period.id, '别的课次')
    // 高馨云不属于「另一门课」，跨课次学生必须被拒绝
    await expect(
      service.generate({ lessonId: otherLesson.id, studentId: student.id, transcriptText: 'x' }),
    ).rejects.toMatchObject({ name: 'FeedbackServiceError' })
  })
})
