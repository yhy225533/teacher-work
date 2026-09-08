import {
  EXPORT_IPC_CHANNELS,
  failure,
  IPC_ERROR_CODES,
  isEmptyIpcRequest,
  success,
  type IpcChannel,
  type IpcResponse,
} from '../../shared/ipc-contracts'
import {
  isExportPrintPayload,
  isExportPrintRequest,
  isExportPrintResult,
  type ExportPrintRequest,
} from '../../shared/export-contracts'
import { ExportService, ExportServiceError, type ExportServicePorts, type PrintToPdfOptions, type PrintWindow } from '../export/export-service'
import type { IpcLogger, IpcMainPort } from './app-ipc'

export interface ExportIpcDependencies {
  readonly getService: () => ExportService
}

export const EXPORT_CHANNELS: readonly IpcChannel[] = Object.values(EXPORT_IPC_CHANNELS)

class ExportIpcRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportIpcRequestError'
  }
}

/**
 * V19-D：三条 export:* 通道的白名单分发。
 * - `export:print-to-pdf`：主窗请求导出（载荷守卫 + Main 二次校验在 service）；
 * - `export:get-print-payload` / `export:print-ready`：**仅本次打印窗 sender 可调**
 *   （比对 webContents.id），防主窗 Renderer 冒充打印窗套取文件清单。
 */
export function registerExportIpc(
  ipcMain: IpcMainPort,
  dependencies: ExportIpcDependencies,
  logger: IpcLogger,
): () => void {
  for (const channel of EXPORT_CHANNELS) {
    ipcMain.handle(channel, (event, payload) =>
      dispatchExportIpc(channel, payload, event, dependencies, logger),
    )
  }
  return () => {
    for (const channel of EXPORT_CHANNELS) ipcMain.removeHandler(channel)
  }
}

export async function dispatchExportIpc(
  channel: string,
  payload: unknown,
  event: unknown,
  dependencies: ExportIpcDependencies,
  logger: IpcLogger,
): Promise<IpcResponse<unknown>> {
  if (!EXPORT_CHANNELS.includes(channel as IpcChannel)) {
    logger.log('warn', 'ipc.unknown_export_channel', { channel })
    return failure(IPC_ERROR_CODES.UNKNOWN_CHANNEL, '未知的 IPC 通道。')
  }
  try {
    const service = dependencies.getService()
    switch (channel) {
      case EXPORT_IPC_CHANNELS.printToPdf: {
        assertRequest(payload, isExportPrintRequest)
        const request = payload as ExportPrintRequest
        return ensureResponse(await service.exportLessonPdf(request), isExportPrintResult)
      }
      case EXPORT_IPC_CHANNELS.getPrintPayload: {
        assertRequest(payload, isEmptyIpcRequest)
        const senderId = extractIpcSenderId(event)
        if (senderId === null) {
          throw new ExportServiceError('EXPORT_ERROR', '无法识别打印窗口，已拒绝读取导出载荷。')
        }
        return ensureResponse(service.getPrintPayloadFor(senderId), isExportPrintPayload)
      }
      case EXPORT_IPC_CHANNELS.printReady: {
        assertRequest(payload, isEmptyIpcRequest)
        const senderId = extractIpcSenderId(event)
        if (senderId === null) {
          throw new ExportServiceError('EXPORT_ERROR', '无法识别打印窗口，已拒绝就绪信号。')
        }
        service.acceptPrintReady(senderId)
        return success({ accepted: true })
      }
    }
    throw new Error('Unhandled export IPC channel')
  } catch (error) {
    const response = mapExportIpcError(error)
    // 日志只记通道与错误码：正文、文件清单、保存路径一律不进日志（D54）。
    logger.error('ipc.export_request_failed', error, {
      channel,
      code: response.ok ? undefined : response.error.code,
    })
    return response
  }
}

/** 从 IPC event 提取 sender 的 webContents.id（extractIpcSender 先例的最小面变体）。 */
export function extractIpcSenderId(event: unknown): number | null {
  if (typeof event !== 'object' || event === null) return null
  const sender = (event as { sender?: unknown }).sender
  if (typeof sender !== 'object' || sender === null) return null
  const id = (sender as { id?: unknown }).id
  return typeof id === 'number' ? id : null
}

function assertRequest<T>(
  payload: unknown,
  guard: (value: unknown) => value is T,
): asserts payload is T {
  if (!guard(payload)) throw new ExportIpcRequestError('请求参数无效。')
}

function ensureResponse<T>(value: T, guard: (candidate: unknown) => candidate is T): IpcResponse<T> {
  if (!guard(value)) throw new Error('Export service returned an invalid response')
  return success(value)
}

function mapExportIpcError(error: unknown): IpcResponse<never> {
  if (error instanceof ExportIpcRequestError) {
    return failure(IPC_ERROR_CODES.INVALID_PAYLOAD, error.message)
  }
  if (error instanceof ExportServiceError) {
    if (error.code === 'EXPORT_BUSY') return failure(IPC_ERROR_CODES.EXPORT_BUSY, error.message)
    if (error.code === 'EXPORT_TIMEOUT') return failure(IPC_ERROR_CODES.EXPORT_TIMEOUT, error.message)
    return failure(IPC_ERROR_CODES.EXPORT_ERROR, error.message)
  }
  return failure(IPC_ERROR_CODES.INTERNAL_ERROR, '导出失败，请稍后重试。')
}

export type { ExportService, ExportServiceError, ExportServicePorts, PrintToPdfOptions, PrintWindow }
