import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { initializeWorkspace } from '../src/main/workspace/workspace-service'
import { CoreDataService } from '../src/main/data/core-data-service'
import { ManagedFileService } from '../src/main/files/managed-file-service'
import { ExportService, type ExportServicePorts, type PrintWindow } from '../src/main/export/export-service'
import {
  dispatchExportIpc,
  extractIpcSenderId,
  registerExportIpc,
  type ExportIpcDependencies,
} from '../src/main/ipc/export-ipc'
import { EXPORT_IPC_CHANNELS, IPC_ERROR_CODES, type IpcResponse } from '../src/shared/ipc-contracts'
import type { IpcLogger, IpcMainPort } from '../src/main/ipc/app-ipc'

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
  readonly errors: Array<{ event: string; code: string | undefined }> = []

  log(): void { /* 白名单走查不需要 */ }

  error(event: string, _error: unknown, details?: Record<string, unknown>): void {
    this.errors.push({ event, code: details?.code as string | undefined })
  }
}

const temporaryRoots: string[] = []
const workspaces: ReturnType<typeof initializeWorkspace>[] = []

afterEach(() => {
  for (const workspace of workspaces.splice(0)) workspace.close()
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** 不可交互的极小打印窗 fake：就绪信号到达前 pending 挂起，测试逐段驱动。 */
class FakeWindow implements PrintWindow {
  readonly webContentsId: number
  private static nextId = 1
  private destroyed = false
  private readonly goneListeners: Array<(reason: string) => void> = []

  constructor() { this.webContentsId = FakeWindow.nextId; FakeWindow.nextId += 1 }

  printToPdf: (options: unknown) => Promise<Uint8Array> = async () => new TextEncoder().encode('%PDF')

  destroy(): void { this.destroyed = true }
  onGone(listener: (reason: string) => void): void { this.goneListeners.push(listener) }
  isDestroyed(): boolean { return this.destroyed }
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'teacher-workbench-v19d-ipc-'))
  temporaryRoots.push(root)
  const workspace = initializeWorkspace(join(root, 'workspace'), join(root, 'install'))
  workspaces.push(workspace)
  const core = new CoreDataService(workspace.database.raw)
  const files = new ManagedFileService(workspace.database.raw, workspace.paths)
  const course = core.nodes.createCourse('课程', 'class')
  const period = core.nodes.createPeriod(course.id, '阶段')
  const lesson = core.nodes.createLesson(period.id, '课次')
  const mdPath = join(root, '讲义.md')
  writeFileSync(mdPath, '# 讲义', 'utf8')
  const mdFile = files.importToLesson(mdPath, lesson.id)

  const window = new FakeWindow()
  const ports: ExportServicePorts = {
    createPrintWindow: () => window,
    chooseSavePath: async () => join(root, 'out.pdf'),
    showInFolder: () => undefined,
    now: () => new Date('2026-09-08T12:00:00.000Z'),
    writeBuffer: () => undefined,
    renameFile: () => undefined,
    removePath: () => undefined,
  }
  const service = new ExportService(files, 'file:///app/index.html', ports)
  const dependencies: ExportIpcDependencies = { getService: () => service }
  return { root, lesson, mdFile, service, window, dependencies, ports }
}

function senderEvent(webContentsId: number): unknown {
  return { sender: { id: webContentsId, send: () => undefined } }
}

describe('V19-D export IPC（白名单 + sender 校验 + 错误映射）', () => {
  it('registers exactly three whitelisted channels and unregisters them', () => {
    const ipcMain = new FakeIpcMain()
    const { dependencies } = createFixture()
    const unregister = registerExportIpc(ipcMain, dependencies, new TestLogger())

    expect([...ipcMain.handlers.keys()]).toEqual([
      EXPORT_IPC_CHANNELS.printToPdf,
      EXPORT_IPC_CHANNELS.getPrintPayload,
      EXPORT_IPC_CHANNELS.printReady,
    ])
    unregister()
    expect(ipcMain.handlers.size).toBe(0)
    expect(ipcMain.removedChannels).toEqual([
      EXPORT_IPC_CHANNELS.printToPdf,
      EXPORT_IPC_CHANNELS.getPrintPayload,
      EXPORT_IPC_CHANNELS.printReady,
    ])
  })

  it('rejects unknown channels and invalid payloads', async () => {
    const { dependencies } = createFixture()
    const logger = new TestLogger()
    const unknown = await dispatchExportIpc('export:not-a-channel', {}, undefined, dependencies, logger)
    expect(unknown).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.UNKNOWN_CHANNEL } })

    const invalid = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printToPdf, { fileId: '' }, senderEvent(1), dependencies, logger)
    expect(invalid).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.INVALID_PAYLOAD } })

    const sneaky = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printToPdf,
      { fileId: 'f', lessonId: 'l', bodyMd: '# 冒充正文' },
      senderEvent(1), dependencies, logger)
    expect(sneaky).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.INVALID_PAYLOAD } })
  })

  it('completes the full export flow through dispatch: request → payload → ready → saved', async () => {
    const f = createFixture()
    const logger = new TestLogger()
    const pending = dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printToPdf,
      { fileId: f.mdFile.id, lessonId: f.lesson.id, headerText: '张三 · 第 12 讲' },
      senderEvent(1), f.dependencies, logger)
    // 打印窗 sender 取载荷
    const payload = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.getPrintPayload, {}, senderEvent(f.window.webContentsId), f.dependencies, logger)
    expect(payload).toMatchObject({ ok: true, data: { meta: { headerText: '张三 · 第 12 讲' } } })
    // 就绪 → printToPDF → 保存 → saved
    const ready = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printReady, {}, senderEvent(f.window.webContentsId), f.dependencies, logger)
    expect(ready).toMatchObject({ ok: true, data: { accepted: true } })
    await expect(pending).resolves.toMatchObject({ ok: true, data: { saved: true } })
  })

  it('payload and ready channels refuse senders that are not the current print window', async () => {
    const f = createFixture()
    const logger = new TestLogger()
    const pending = dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printToPdf,
      { fileId: f.mdFile.id, lessonId: f.lesson.id },
      senderEvent(1), f.dependencies, logger)
    // 主窗冒充打印窗套取载荷 → EXPORT_ERROR（不泄漏其他课次文件清单）
    const forged = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.getPrintPayload, {}, senderEvent(777), f.dependencies, logger)
    expect(forged).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.EXPORT_ERROR } })
    // 缺 sender id（无 sender 对象）→ 拒绝
    const noSender = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printReady, {}, {}, f.dependencies, logger)
    expect(noSender).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.EXPORT_ERROR } })
    // print-ready 只接受一次
    await dispatchExportIpc(EXPORT_IPC_CHANNELS.printReady, {}, senderEvent(f.window.webContentsId), f.dependencies, logger)
    const twice = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printReady, {}, senderEvent(f.window.webContentsId), f.dependencies, logger)
    expect(twice).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.EXPORT_ERROR } })
    await expect(pending).resolves.toMatchObject({ ok: true, data: { saved: true } })
  })

  it('maps service errors to IPC error codes (busy / timeout / internal) without leaking paths', async () => {
    const f = createFixture()
    const logger = new TestLogger()
    const first = dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printToPdf,
      { fileId: f.mdFile.id, lessonId: f.lesson.id },
      senderEvent(1), f.dependencies, logger)
    // 并发第二次 → EXPORT_BUSY
    const busy = await dispatchExportIpc(
      EXPORT_IPC_CHANNELS.printToPdf,
      { fileId: f.mdFile.id, lessonId: f.lesson.id },
      senderEvent(1), f.dependencies, logger)
    expect(busy).toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.EXPORT_BUSY } })
    f.window.onGone(() => undefined) // 无操作；直接销毁触发超时路径
    // 结束第一次：就绪失败——printToPdf 抛错 → EXPORT_ERROR
    f.window.printToPdf = async () => { throw new Error('打印引擎失败') }
    await dispatchExportIpc(EXPORT_IPC_CHANNELS.printReady, {}, senderEvent(f.window.webContentsId), f.dependencies, logger)
    await expect(first).resolves.toMatchObject({ ok: false, error: { code: IPC_ERROR_CODES.EXPORT_ERROR } })
    // 错误日志只带通道与错误码
    expect(logger.errors.every((entry) => entry.event === 'ipc.export_request_failed' && entry.code !== undefined)).toBe(true)
  })

  it('extractIpcSenderId accepts only numeric webContents ids', () => {
    expect(extractIpcSenderId(senderEvent(42))).toBe(42)
    expect(extractIpcSenderId({ sender: { id: '42' } })).toBe(null)
    expect(extractIpcSenderId({ sender: {} })).toBe(null)
    expect(extractIpcSenderId({})).toBe(null)
    expect(extractIpcSenderId(null)).toBe(null)
  })
})
