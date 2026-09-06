import Database from 'better-sqlite3'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { AiGateway } from '../src/main/ai/ai-gateway'
import { AiSettingsService } from '../src/main/ai/ai-settings-service'
import type { SecureStoragePort } from '../src/main/ai/secure-storage'
import { CoreDataService } from '../src/main/data/core-data-service'
import { runMigrations } from '../src/main/db/migrations'
import { FeedbackService } from '../src/main/feedback/feedback-service'
import { dispatchFeedbackIpc, registerFeedbackIpc, FEEDBACK_CHANNELS } from '../src/main/ipc/feedback-ipc'
import type { IpcLogger, IpcMainPort } from '../src/main/ipc/app-ipc'
import { SkillService } from '../src/main/skills/skill-service'
import {
  FEEDBACK_IPC_CHANNELS,
  IPC_ERROR_CODES,
  type IpcResponse,
} from '../src/shared/ipc-contracts'

class FakeIpcMain implements IpcMainPort {
  readonly handlers = new Map<string, (event: unknown, payload: unknown) => Promise<IpcResponse<unknown>>>()
  readonly removedChannels: string[] = []
  handle(channel: string, listener: (event: unknown, payload: unknown) => Promise<IpcResponse<unknown>>): void {
    this.handlers.set(channel, listener)
  }
  removeHandler(channel: string): void {
    this.handlers.delete(channel)
    this.removedChannels.push(channel)
  }
}

class TestLogger implements IpcLogger {
  readonly lines: string[] = []
  log(_level: 'info' | 'warn', event: string, meta?: Record<string, unknown>): void {
    this.lines.push(JSON.stringify({ event, ...(meta ?? {}) }))
  }
  error(event: string, error: unknown, meta?: Record<string, unknown>): void {
    this.lines.push(JSON.stringify({ event, error: String(error), ...(meta ?? {}) }))
  }
}

class MemoryStorage implements SecureStoragePort {
  isAvailable(): boolean { return false }
  encrypt(value: string): Buffer { return Buffer.from(value) }
  decrypt(value: Buffer): string { return value.toString() }
  read(): Buffer | undefined { return undefined }
  write(): void { /* session key path only in tests */ }
  clear(): void { /* nothing persisted */ }
}

const fixtureDirs: string[] = []
afterEach(() => {
  for (const dir of fixtureDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fixture(options: { readonly transcriptPath?: string } = {}) {
  const database = new Database(':memory:')
  database.pragma('foreign_keys = ON')
  runMigrations(database)
  const core = new CoreDataService(database)
  const course = core.nodes.createCourse('V18 IPC 课程', 'one_to_one')
  const period = core.nodes.createPeriod(course.id, '阶段')
  const lesson = core.nodes.createLesson(period.id, '课次一')
  const student = core.createStudent('学生甲')
  core.linkStudentToCourse(course.id, student.id)
  const settings = new AiSettingsService(database, { secureStorage: new MemoryStorage() })
  settings.updateSettings({
    provider: 'openai-compatible',
    model: 'deepseek-chat',
    endpoint: 'https://api.example.com/v1',
    apiKey: 'test-key',
  })
  const gateway = new AiGateway(settings, {
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '整理后的反馈草稿' } }], model: 'deepseek-chat' }),
      text: async () => JSON.stringify({}),
    }) as never,
  })
  const service = new FeedbackService({
    coreData: core,
    skills: new SkillService(database),
    aiGateway: gateway,
    chooseTranscript: async () => options.transcriptPath ?? null,
  })
  return { database, core, lesson, student, service }
}

describe('V18-A feedback IPC', () => {
  it('registers only the two whitelisted channels and unregisters them', () => {
    const ipcMain = new FakeIpcMain()
    const logger = new TestLogger()
    const { service } = fixture()
    const unregister = registerFeedbackIpc(ipcMain, { getService: () => service }, logger)

    expect([...ipcMain.handlers.keys()]).toEqual([
      FEEDBACK_IPC_CHANNELS.readTranscript,
      FEEDBACK_IPC_CHANNELS.generate,
    ])
    expect(FEEDBACK_CHANNELS).toEqual([
      FEEDBACK_IPC_CHANNELS.readTranscript,
      FEEDBACK_IPC_CHANNELS.generate,
    ])
    unregister()
    expect(ipcMain.handlers.size).toBe(0)
    expect(ipcMain.removedChannels).toEqual([
      FEEDBACK_IPC_CHANNELS.readTranscript,
      FEEDBACK_IPC_CHANNELS.generate,
    ])
  })

  it('read-transcript: empty payload only, returns null on cancel, result on pick', async () => {
    const logger = new TestLogger()
    const { service, database, lesson, student } = fixture()
    const cancel = await dispatchFeedbackIpc(
      FEEDBACK_IPC_CHANNELS.readTranscript, {}, { getService: () => service }, logger,
    )
    expect(cancel).toEqual({ ok: true, data: null })

    const dir = mkdtempSync(join(tmpdir(), 'v18a-ipc-'))
    fixtureDirs.push(dir)
    const transcriptPath = join(dir, '转写.txt')
    writeFileSync(transcriptPath, '本课讲了有理数的混合运算')

    const picked = fixture({ transcriptPath })
    const result = await dispatchFeedbackIpc(
      FEEDBACK_IPC_CHANNELS.readTranscript, {}, { getService: () => picked.service }, logger,
    )
    expect(result).toEqual({
      ok: true,
      data: { fileName: '转写.txt', text: '本课讲了有理数的混合运算', chars: 12, truncated: false },
    })
    // D43：选文件不登记 files 表、不写任何持久状态
    expect(
      (database.prepare('SELECT COUNT(*) AS count FROM files').get() as { count: number }).count,
    ).toBe(0)
    expect(lesson).toBeDefined()
    expect(student).toBeDefined()

    const rejected = await dispatchFeedbackIpc(
      FEEDBACK_IPC_CHANNELS.readTranscript, { path: 'C:\\evil' }, { getService: () => service }, logger,
    )
    expect(rejected).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.INVALID_PAYLOAD } })
  })

  it('generate: validates the payload guard and returns the non-persisted draft', async () => {
    const logger = new TestLogger()
    const { service, core, lesson, student } = fixture()
    const result = await dispatchFeedbackIpc(
      FEEDBACK_IPC_CHANNELS.generate,
      { lessonId: lesson.id, studentId: student.id, transcriptText: '转写正文' },
      { getService: () => service },
      logger,
    )
    expect(result).toEqual({
      ok: true,
      data: {
        draftText: '整理后的反馈草稿',
        model: 'deepseek-chat',
        promptVersion: 'v18-01-v1',
        inputChars: 4,
      },
    })
    // D43：草稿不落库
    expect(core.getOverview().notes).toHaveLength(0)

    const invalid = await dispatchFeedbackIpc(
      FEEDBACK_IPC_CHANNELS.generate,
      { lessonId: lesson.id, studentId: student.id },
      { getService: () => service },
      logger,
    )
    expect(invalid).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.INVALID_PAYLOAD } })
  })

  it('rejects unknown channels without touching the service', async () => {
    const logger = new TestLogger()
    const { service } = fixture()
    const unknown = await dispatchFeedbackIpc(
      'feedback:unexpected', {}, { getService: () => service }, logger,
    )
    expect(unknown).toEqual({
      ok: false,
      error: { code: IPC_ERROR_CODES.UNKNOWN_CHANNEL, message: '未知的 IPC 通道。' },
    })
    expect(logger.lines.join('\n')).toContain('ipc.unknown_feedback_channel')
  })

  it('maps feedback service errors to FEEDBACK_ERROR and never logs transcript text', async () => {
    const logger = new TestLogger()
    const { service } = fixture()
    const result = await dispatchFeedbackIpc(
      FEEDBACK_IPC_CHANNELS.generate,
      { lessonId: 'missing-lesson', studentId: 'missing-student', transcriptText: '机密转写内容' },
      { getService: () => service },
      logger,
    )
    expect(result).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.FEEDBACK_ERROR } })
    expect(logger.lines.join('\n')).toContain('ipc.feedback_request_failed')
    expect(logger.lines.join('\n')).not.toContain('机密转写内容')
  })
})
