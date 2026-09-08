import { randomUUID } from 'node:crypto'
import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

import {
  EXPORT_BODY_MD_MAX_CHARS,
  EXPORT_TOTAL_TIMEOUT_MS,
  type ExportPrintPayload,
  type ExportPrintResult,
} from '../../shared/export-contracts'
import type { ManagedFileRecord } from '../../shared/file-contracts'
import type { ManagedFileService } from '../files/managed-file-service'

/** 打印窗端口：ExportService 只依赖 BrowserWindow/webContents 的最小面，测试可注入 fake。 */
export interface PrintWindow {
  /** 本次打印窗的 webContents id（载荷/就绪通道的 sender 校验基准）。 */
  readonly webContentsId: number
  readonly printToPdf: (options: PrintToPdfOptions) => Promise<Uint8Array>
  destroy(): void
  /** 崩溃/意外销毁通知（render-process-gone / closed 等），Main 收到即取消本次导出。 */
  onGone(listener: (reason: string) => void): void
  isDestroyed(): boolean
}

export interface PrintToPdfOptions {
  readonly pageSize: 'A4'
  readonly printBackground: boolean
  readonly margins: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number }
  readonly displayHeaderFooter: boolean
  readonly headerTemplate: string
  readonly footerTemplate: string
}

export interface ExportServicePorts {
  /** 创建隐藏打印窗并加载 `?print=1`（index.html 或 dev URL，由接线方决定）。 */
  readonly createPrintWindow: (indexUrl: string) => PrintWindow
  /** A4 纵向 + 页眉页脚模板由服务层组装，窗 URL 注入方只负责窗口本身。 */
  readonly chooseSavePath: (defaultFileName: string) => Promise<string | null>
  readonly showInFolder: (savedPath: string) => void
  readonly now: () => Date
  readonly writeBuffer: (path: string, data: Uint8Array) => void
  readonly renameFile: (sourcePath: string, destinationPath: string) => void
  readonly removePath: (path: string) => void
}

export type ExportErrorCode = 'EXPORT_FILE_INVALID' | 'EXPORT_NOT_LINKED' | 'EXPORT_BODY_TOO_LARGE' | 'EXPORT_BUSY' | 'EXPORT_TIMEOUT' | 'EXPORT_ERROR'

export class ExportServiceError extends Error {
  readonly code: ExportErrorCode

  constructor(code: ExportErrorCode, message: string) {
    super(message)
    this.name = 'ExportServiceError'
    this.code = code
  }
}

interface PendingExport {
  readonly payload: ExportPrintPayload
  readonly window: PrintWindow
  readonly defaultPdfName: string
  resolvePrinted: ((data: Uint8Array) => void) | null
  rejectPrinted: ((error: Error) => void) | null
  printReadySeen: boolean
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * V19-D（D48–D54）：课件导出可打印 PDF 的 Main 编排。
 * - 载荷组装不信任 Renderer 内容（bodyMd 直读 managed 对象正文）；
 * - 单导出串行（并发 → EXPORT_BUSY）；60s 总超时 + 打印窗崩溃 → 销毁清理，不留半成品；
 * - 写盘 = 同目录临时文件 + 原子重命名；响应只含 saved，不回传路径（V11-01）。
 */
export class ExportService {
  private pending: PendingExport | null = null

  constructor(
    private readonly files: ManagedFileService,
    private readonly indexUrl: string,
    private readonly ports: ExportServicePorts,
  ) {}

  /** 打印窗载荷通道：仅本次打印窗可调（export-ipc 先做 sender 比对，再落到这里）。 */
  getPrintPayloadFor(webContentsId: number): ExportPrintPayload {
    if (this.pending === null || this.pending.window.webContentsId !== webContentsId) {
      throw new ExportServiceError('EXPORT_ERROR', '当前没有属于此窗口的导出。')
    }
    return this.pending.payload
  }

  /** 打印窗就绪通道：仅本次打印窗、只允许一次。 */
  acceptPrintReady(webContentsId: number): void {
    const pending = this.pending
    if (pending === null || pending.window.webContentsId !== webContentsId) {
      throw new ExportServiceError('EXPORT_ERROR', '当前没有属于此窗口的导出。')
    }
    if (pending.printReadySeen) {
      throw new ExportServiceError('EXPORT_ERROR', '本次导出的就绪信号只允许出现一次。')
    }
    pending.printReadySeen = true
    pending.window.printToPdf(printToPdfOptions(pending.payload.meta))
      .then((data) => { pending.resolvePrinted?.(data) })
      .catch((error: unknown) => { pending.rejectPrinted?.(toError(error)) })
  }

  isBusy(): boolean {
    return this.pending !== null
  }

  /** before-quit 清理：销毁打印窗（当前导出以 EXPORT_ERROR 拒绝）。 */
  dispose(): void {
    this.rejectPending(new ExportServiceError('EXPORT_ERROR', '导出已中止（应用正在退出）。'))
  }

  async exportLessonPdf(request: {
    readonly fileId: string
    readonly lessonId: string
    readonly headerText?: string
  }): Promise<ExportPrintResult> {
    if (this.pending !== null) {
      throw new ExportServiceError('EXPORT_BUSY', '已有一次导出正在进行中，请稍后再试。')
    }
    const payload = this.buildPayload(request)
    const window = this.ports.createPrintWindow(`${this.indexUrl}?print=1`)
    const pending: PendingExport = {
      payload,
      window,
      defaultPdfName: defaultPdfName(payload.meta.title),
      resolvePrinted: null,
      rejectPrinted: null,
      printReadySeen: false,
      timer: null,
    }
    this.pending = pending
    window.onGone((reason) => {
      this.rejectPending(new ExportServiceError('EXPORT_TIMEOUT', `打印窗口在导出完成前关闭（${reason}）。`))
    })
    try {
      let data: Uint8Array
      try {
        data = await this.awaitPrintedOrTimeout(pending)
      } catch (error) {
        // 打印窗崩溃/就绪失败/printToPDF 引擎错误统一映射为稳定 EXPORT_ERROR（非超时类）。
        if (error instanceof ExportServiceError) throw error
        throw new ExportServiceError('EXPORT_ERROR', '生成 PDF 失败，请稍后重试。')
      }
      const savedPath = await this.ports.chooseSavePath(pending.defaultPdfName)
      if (savedPath === null) return { saved: false }
      this.saveAtomically(savedPath, data)
      this.ports.showInFolder(savedPath)
      return { saved: true }
    } finally {
      this.rejectPending(new ExportServiceError('EXPORT_ERROR', '导出流程已结束。'))
    }
  }

  private buildPayload(request: {
    readonly fileId: string
    readonly lessonId: string
    readonly headerText?: string
  }): ExportPrintPayload {
    // Main 二次校验：active managed md 文件 + 挂课关系（不信任 Renderer 声明）。
    // readText 对非文本/超大/不存在文件抛 ManagedFileError → 统一映射 EXPORT_FILE_INVALID 稳定错误。
    let read: { file: ManagedFileRecord; content: string }
    try {
      read = this.files.readText(request.fileId)
    } catch (error) {
      throw new ExportServiceError('EXPORT_FILE_INVALID', error instanceof Error ? error.message : '课件文件无法读取。')
    }
    const { file, content } = read
    if (file.mimeType !== 'text/markdown') {
      throw new ExportServiceError('EXPORT_FILE_INVALID', '只能导出 Markdown 课件。')
    }
    if (content.length > EXPORT_BODY_MD_MAX_CHARS) {
      throw new ExportServiceError('EXPORT_BODY_TOO_LARGE', '课件正文过大，暂不支持导出。')
    }
    const overview = this.files.getOverview()
    const linked = overview.links.some((link) =>
      link.targetType === 'lesson' && link.targetId === request.lessonId && link.fileId === request.fileId)
    if (!linked) {
      throw new ExportServiceError('EXPORT_NOT_LINKED', '该文件没有挂到指定课次，无法导出。')
    }
    // files = 该课次全部 active managed 文件清单（供打印窗图片按名匹配 dataUrl）。
    const linkedFileIds = new Set(overview.links
      .filter((link) => link.targetType === 'lesson' && link.targetId === request.lessonId)
      .map((link) => link.fileId))
    const lessonFiles: ManagedFileRecord[] = overview.files.filter(
      (candidate) => linkedFileIds.has(candidate.id),
    )
    return {
      bodyMd: content,
      files: lessonFiles,
      meta: {
        title: stripMarkdownExtension(file.originalName),
        headerText: request.headerText ?? '',
        exportDate: localDateString(this.ports.now()),
      },
    }
  }

  private awaitPrintedOrTimeout(pending: PendingExport): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      pending.resolvePrinted = resolve
      pending.rejectPrinted = reject
      pending.timer = setTimeout(() => {
        this.rejectPending(new ExportServiceError('EXPORT_TIMEOUT', '导出超时：打印视图未在限定时间内就绪。'))
      }, EXPORT_TOTAL_TIMEOUT_MS)
    })
  }

  /** 同目录临时文件 + 原子重命名：失败清理临时文件并给稳定错误，不留半成品。 */
  private saveAtomically(targetPath: string, data: Uint8Array): void {
    const temporaryPath = join(dirname(targetPath), `.${basename(targetPath)}.${randomUUID()}.tmp`)
    try {
      this.ports.writeBuffer(temporaryPath, data)
      this.ports.renameFile(temporaryPath, targetPath)
    } catch (error) {
      this.ports.removePath(temporaryPath)
      throw new ExportServiceError('EXPORT_ERROR', `无法写入所选位置的文件（${toErrorMessage(error)}）。`)
    }
  }

  private rejectPending(error: ExportServiceError): void {
    const pending = this.pending
    this.pending = null
    if (pending === null) return
    if (pending.timer !== null) clearTimeout(pending.timer)
    if (!pending.window.isDestroyed()) pending.window.destroy()
    pending.rejectPrinted?.(error)
  }
}

export function printToPdfOptions(meta: ExportPrintPayload['meta']): PrintToPdfOptions {
  // §5 版式：A4 纵向；margins 上下 0.63" / 左右 0.55"；白底黑字；页眉左=headerText、右=导出日期；页脚居中页码。
  const headerText = escapeHtml(meta.headerText)
  const exportDate = escapeHtml(meta.exportDate)
  return {
    pageSize: 'A4',
    printBackground: false,
    margins: { top: 0.63, bottom: 0.63, left: 0.55, right: 0.55 },
    displayHeaderFooter: true,
    headerTemplate: `<div style="width:100%;padding:0 8px;font-size:9px;color:#64748b;display:flex;justify-content:space-between;">
<span>${headerText === '' ? '&nbsp;' : headerText}</span><span>${exportDate}</span></div>`,
    footerTemplate: `<div style="width:100%;font-size:9px;color:#64748b;text-align:center;">
第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>`,
  }
}

/** 默认保存名：原名 `.md`（含学生版等任意 md 命名）→ `.pdf`。 */
export function defaultPdfName(metaTitle: string): string {
  return `${metaTitle}.pdf`
}

/** meta.title = originalName 去掉一个 md 扩展名（`.md`，大小写不敏感）；无扩展名原样保留。 */
export function stripMarkdownExtension(originalName: string): string {
  if (extname(originalName).toLowerCase() === '.md') {
    return originalName.slice(0, -extname(originalName).length)
  }
  return originalName
}

function localDateString(now: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

function toErrorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

/** 接线方（main/index.ts）用的默认端口实现；测试注入自己的 fake。 */
export function createNodeFsPorts(overrides: Partial<ExportServicePorts> = {}): Pick<ExportServicePorts, 'now' | 'writeBuffer' | 'renameFile' | 'removePath'> {
  return {
    now: () => new Date(),
    writeBuffer: (path, data) => { writeFileSync(path, data) },
    renameFile: (source, destination) => { renameSync(source, destination) },
    removePath: (path) => { rmSync(path, { force: true }) },
    ...overrides,
  }
}
