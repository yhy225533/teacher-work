import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { initializeWorkspace } from '../src/main/workspace/workspace-service'
import { CoreDataService } from '../src/main/data/core-data-service'
import { ManagedFileService } from '../src/main/files/managed-file-service'
import {
  defaultPdfName,
  ExportService,
  type ExportServicePorts,
  printToPdfOptions,
  type PrintWindow,
} from '../src/main/export/export-service'

const temporaryRoots: string[] = []
const workspaces: ReturnType<typeof initializeWorkspace>[] = []

afterEach(() => {
  for (const workspace of workspaces.splice(0)) workspace.close()
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function createFixture(options: { readonly printDelayMs?: number } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'teacher-workbench-v19d-'))
  temporaryRoots.push(root)
  const workspace = initializeWorkspace(join(root, 'workspace'), join(root, 'install'))
  workspaces.push(workspace)
  const core = new CoreDataService(workspace.database.raw)
  const files = new ManagedFileService(workspace.database.raw, workspace.paths)
  const course = core.nodes.createCourse('课程', 'class')
  const period = core.nodes.createPeriod(course.id, '阶段')
  const targetLesson = core.nodes.createLesson(period.id, '目标课次')
  const otherLesson = core.nodes.createLesson(period.id, '其他课次')

  // 目标 md 课件挂到目标课次；另一张图片也挂同课次（载荷 files 应含全部课次文件）
  const mdPath = join(root, '讲义.md')
  writeFileSync(mdPath, '# 有理数\n\n$x^2 = 4$', 'utf8')
  const mdFile = files.importToLesson(mdPath, targetLesson.id)
  const imagePath = join(root, '题图.png')
  writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const imageFile = files.importToLesson(imagePath, targetLesson.id)
  // 干扰文件：挂其他课次，绝不能进入载荷
  const strayPath = join(root, '别课.md')
  writeFileSync(strayPath, '# 别课内容', 'utf8')
  const strayFile = files.importToLesson(strayPath, otherLesson.id)

  const createdWindows: FakePrintWindow[] = []
  const written: { path: string; data: Uint8Array }[] = []
  const renamed: { from: string; to: string }[] = []
  const removedPaths: string[] = []
  const shownFolders: string[] = []
  let chooseSavePathImpl: (defaultFileName: string) => Promise<string | null> =
    async () => join(root, 'out.pdf')

  const ports: ExportServicePorts = {
    createPrintWindow: (url) => {
      expect(url).toContain('?print=1')
      const window = new FakePrintWindow(url, options.printDelayMs)
      createdWindows.push(window)
      return window
    },
    chooseSavePath: (defaultFileName) => chooseSavePathImpl(defaultFileName),
    showInFolder: (savedPath) => shownFolders.push(savedPath),
    now: () => new Date('2026-09-08T12:00:00.000Z'),
    writeBuffer: (path, data) => written.push({ path, data }),
    renameFile: (from, to) => renamed.push({ from, to }),
    removePath: (path) => removedPaths.push(path),
  }
  const service = new ExportService(files, 'file:///app/index.html', ports)

  return {
    root, workspace, core, files, lesson: targetLesson, otherLesson, mdFile, imageFile, strayFile,
    service, createdWindows, written, renamed, removedPaths, shownFolders,
    setChooseSavePath: (impl: (name: string) => Promise<string | null>) => { chooseSavePathImpl = impl },
  }
}

class FakePrintWindow implements PrintWindow {
  readonly webContentsId: number
  private static nextId = 1
  private readonly goneListeners: Array<(reason: string) => void> = []
  private destroyed = false
  readonly printedOptions: export_service_TestPrintOptions[] = []

  constructor(readonly url: string, private readonly printDelayMs: number | undefined) {
    this.webContentsId = FakePrintWindow.nextId
    FakePrintWindow.nextId += 1
  }

  async printToPdf(options: Parameters<PrintWindow['printToPdf']>[0]): Promise<Uint8Array> {
    this.printedOptions.push(options as export_service_TestPrintOptions)
    if (this.printDelayMs !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, this.printDelayMs))
    }
    return new TextEncoder().encode('%PDF-fake')
  }

  destroy(): void { this.destroyed = true }

  onGone(listener: (reason: string) => void): void { this.goneListeners.push(listener) }

  isDestroyed(): boolean { return this.destroyed }

  emitGone(reason: string): void { for (const listener of this.goneListeners) listener(reason) }
}

interface export_service_TestPrintOptions { readonly pageSize: string }

describe('V19-D ExportService 编排（注入 fake 端口）', () => {
  it('saves atomically with default name, shows in folder, and destroys the print window', async () => {
    const f = createFixture()
    const pending = f.service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: f.lesson.id, headerText: '张三 · 第 12 讲' })
    await vi.waitFor(() => expect(f.createdWindows).toHaveLength(1))
    const window = f.createdWindows[0]!
    // 载荷：bodyMd 来自 Main 直读，files 只含目标课次（md + 图片），meta 含 title/headerText/日期
    const payload = f.service.getPrintPayloadFor(window.webContentsId)
    expect(payload.bodyMd).toContain('有理数')
    expect(payload.files.map((file) => file.id).sort()).toEqual([f.imageFile.id, f.mdFile.id].sort())
    expect(payload.meta).toEqual({ title: '讲义', headerText: '张三 · 第 12 讲', exportDate: '2026-09-08' })
    f.service.acceptPrintReady(window.webContentsId)

    const result = await pending
    expect(result).toEqual({ saved: true })
    // 默认名 = 原名 .md → .pdf；保存对话框收到该默认名
    // 临时文件 → 原子重命名 → showInFolder；结束后打印窗销毁
    expect(f.written).toHaveLength(1)
    expect(f.written[0]!.path.endsWith('.tmp')).toBe(true)
    expect(f.renamed).toEqual([{ from: f.written[0]!.path, to: join(f.root, 'out.pdf') }])
    expect(f.shownFolders).toEqual([join(f.root, 'out.pdf')])
    expect(f.removedPaths).toEqual([])
    expect(window.isDestroyed()).toBe(true)
  })

  it('returns saved:false without error when the save dialog is cancelled', async () => {
    const f = createFixture()
    f.setChooseSavePath(async () => null)
    const pending = f.service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: f.lesson.id })
    await vi.waitFor(() => expect(f.createdWindows).toHaveLength(1))
    const window = f.createdWindows[0]!
    f.service.acceptPrintReady(window.webContentsId)
    await expect(pending).resolves.toEqual({ saved: false })
    expect(f.written).toEqual([])
    expect(f.shownFolders).toEqual([])
    expect(window.isDestroyed()).toBe(true)
  })

  it('maps rename failure to a stable error and cleans the temporary file', async () => {
    const f = createFixture()
    // 用真实 fake 窗口 + 失败的重命名端口：临时文件写盘成功、重命名被"占用"拒绝
    const window = new FakePrintWindow('file:///app/index.html?print=1', undefined)
    const service = new ExportService(f.files, 'file:///app/index.html', {
      createPrintWindow: (url) => { expect(url).toContain('?print=1'); return window },
      chooseSavePath: async () => join(f.root, 'locked.pdf'),
      showInFolder: () => undefined,
      now: () => new Date('2026-09-08T12:00:00.000Z'),
      writeBuffer: (path, data) => { writeFileSync(path, data) },
      renameFile: (): void => { throw new Error('目标文件被占用') },
      removePath: (path) => { rmSync(path, { force: true }) },
    })
    const pending = service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: f.lesson.id })
    await vi.waitFor(() => expect(service.isBusy()).toBe(true))
    service.acceptPrintReady(window.webContentsId)
    await expect(pending).rejects.toMatchObject({ code: 'EXPORT_ERROR' })
    // 临时文件必须被清理（removePath 被调用），目标位置不留半成品
    expect(() => readFileSync(join(f.root, 'locked.pdf'))).toThrow()
  })

  it('rejects concurrent exports with EXPORT_BUSY', async () => {
    const f = createFixture()
    const pending = f.service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: f.lesson.id })
    await vi.waitFor(() => expect(f.createdWindows).toHaveLength(1))
    await expect(
      f.service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: f.lesson.id }),
    ).rejects.toMatchObject({ code: 'EXPORT_BUSY' })
    f.createdWindows[0]!.emitGone('clean-up') // 结束第一次导出，避免悬挂
    await expect(pending).rejects.toMatchObject({ code: 'EXPORT_TIMEOUT' })
  })

  it('fails with EXPORT_TIMEOUT when the print window never becomes ready', async () => {
    const f = createFixture()
    vi.useFakeTimers()
    try {
      const pending = f.service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: f.lesson.id })
      const assertion = expect(pending).rejects.toMatchObject({ code: 'EXPORT_TIMEOUT' })
      await vi.advanceTimersByTimeAsync(60_000)
      await assertion
      expect(f.createdWindows[0]!.isDestroyed()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects payload/ready calls from a sender that is not the current print window', async () => {
    const f = createFixture()
    const pending = f.service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: f.lesson.id })
    await vi.waitFor(() => expect(f.createdWindows).toHaveLength(1))
    expect(() => f.service.getPrintPayloadFor(999999)).toThrow('当前没有属于此窗口的导出')
    expect(() => f.service.acceptPrintReady(999999)).toThrow('当前没有属于此窗口的导出')
    // ready 只允许一次：第二次同 sender 也拒绝
    f.service.acceptPrintReady(f.createdWindows[0]!.webContentsId)
    expect(() => f.service.acceptPrintReady(f.createdWindows[0]!.webContentsId)).toThrow('只允许出现一次')
    f.createdWindows[0]!.emitGone('clean-up')
    await expect(pending).rejects.toMatchObject({ code: 'EXPORT_TIMEOUT' })
  })

  it('validates Main-side: non-md file, unlinked lesson, and cross-lesson payload isolation', async () => {
    const f = createFixture()
    // 非 md（图片）不能导出（readText 拒绝非文本 → EXPORT_FILE_INVALID 稳定映射）
    await expect(
      f.service.exportLessonPdf({ fileId: f.imageFile.id, lessonId: f.lesson.id }),
    ).rejects.toMatchObject({ code: 'EXPORT_FILE_INVALID' })
    // md 未挂到指定课次（挂在其他课）→ EXPORT_NOT_LINKED
    await expect(
      f.service.exportLessonPdf({ fileId: f.strayFile.id, lessonId: f.lesson.id }),
    ).rejects.toMatchObject({ code: 'EXPORT_NOT_LINKED' })
    // 不存在的课次
    await expect(
      f.service.exportLessonPdf({ fileId: f.mdFile.id, lessonId: 'no-such-lesson' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('课次') })
    // BUSY 状态归零（前面三步都失败，未留 pending）
    expect(f.service.isBusy()).toBe(false)
    expect(f.createdWindows).toEqual([])
  })

  it('A4 layout options: portrait margins, header/footer templates from meta', () => {
    const options = printToPdfOptions({ title: 't', headerText: '高馨云 · 第12讲', exportDate: '2026-09-08' })
    expect(options.pageSize).toBe('A4')
    expect(options.printBackground).toBe(false)
    expect(options.displayHeaderFooter).toBe(true)
    expect(options.margins).toEqual({ top: 0.63, bottom: 0.63, left: 0.55, right: 0.55 })
    expect(options.headerTemplate).toContain('高馨云 · 第12讲')
    expect(options.headerTemplate).toContain('2026-09-08')
    expect(options.footerTemplate).toContain('pageNumber')
    expect(options.footerTemplate).toContain('totalPages')
    // HTML 注入防护：headerText 转义后不再包含裸标签
    const hostile = printToPdfOptions({ title: 't', headerText: '<script>x</script>', exportDate: '2026-09-08' })
    expect(hostile.headerTemplate).not.toContain('<script>')
    expect(hostile.headerTemplate).toContain('&lt;script&gt;')
  })

  it('defaultPdfName and stripMarkdownExtension naming rules', () => {
    expect(defaultPdfName('讲义 · 第 3 版')).toBe('讲义 · 第 3 版.pdf')
  })
})

