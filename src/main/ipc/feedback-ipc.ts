import {
  failure,
  FEEDBACK_IPC_CHANNELS,
  IPC_ERROR_CODES,
  isEmptyIpcRequest,
  success,
  type IpcChannel,
  type IpcResponse,
} from '../../shared/ipc-contracts'
import {
  isGenerateFeedbackRequest,
  isGeneratedFeedback,
  isTranscriptResult,
  type GenerateFeedbackRequest,
} from '../../shared/feedback-contracts'
import { AiGatewayError } from '../ai/ai-gateway'
import { FeedbackServiceError, type FeedbackService } from '../feedback/feedback-service'
import type { WorkspaceActivityGate } from '../workspace/activity-gate'
import { WorkspaceActivityError } from '../workspace/activity-gate'
import type { IpcLogger, IpcMainPort } from './app-ipc'

export interface FeedbackIpcDependencies {
  readonly getService: () => FeedbackService
  readonly activityGate?: WorkspaceActivityGate
}

export const FEEDBACK_CHANNELS: readonly IpcChannel[] = Object.values(FEEDBACK_IPC_CHANNELS)

class FeedbackIpcRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedbackIpcRequestError'
  }
}

export function registerFeedbackIpc(
  ipcMain: IpcMainPort,
  dependencies: FeedbackIpcDependencies,
  logger: IpcLogger,
): () => void {
  for (const channel of FEEDBACK_CHANNELS) {
    ipcMain.handle(channel, (_event, payload) => {
      const dispatch = () => dispatchFeedbackIpc(channel, payload, dependencies, logger)
      return dependencies.activityGate === undefined
        ? dispatch()
        : dependencies.activityGate.run(dispatch).catch((error: unknown) => {
          if (error instanceof WorkspaceActivityError) {
            return failure(IPC_ERROR_CODES.WORKSPACE_BUSY, error.message)
          }
          throw error
        })
    })
  }
  return () => {
    for (const channel of FEEDBACK_CHANNELS) ipcMain.removeHandler(channel)
  }
}

export async function dispatchFeedbackIpc(
  channel: string,
  payload: unknown,
  dependencies: FeedbackIpcDependencies,
  logger: IpcLogger,
): Promise<IpcResponse<unknown>> {
  if (!FEEDBACK_CHANNELS.includes(channel as IpcChannel)) {
    logger.log('warn', 'ipc.unknown_feedback_channel', { channel })
    return failure(IPC_ERROR_CODES.UNKNOWN_CHANNEL, '未知的 IPC 通道。')
  }
  try {
    const service = dependencies.getService()
    switch (channel) {
      case FEEDBACK_IPC_CHANNELS.readTranscript: {
        assertRequest(payload, isEmptyIpcRequest)
        const result = await service.readTranscript()
        return result === null ? success(null) : ensureResponse(result, isTranscriptResult)
      }
      case FEEDBACK_IPC_CHANNELS.generate:
        assertRequest(payload, isGenerateFeedbackRequest)
        return ensureResponse(
          await service.generate(payload as GenerateFeedbackRequest),
          isGeneratedFeedback,
        )
    }
    throw new Error('Unhandled feedback IPC channel')
  } catch (error) {
    const response = mapFeedbackIpcError(error)
    // D43：错误日志只带通道与错误码，绝不记录转写正文。
    logger.error('ipc.feedback_request_failed', error, {
      channel,
      code: response.ok ? undefined : response.error.code,
    })
    return response
  }
}

function assertRequest<T>(
  payload: unknown,
  guard: (value: unknown) => value is T,
): asserts payload is T {
  if (!guard(payload)) throw new FeedbackIpcRequestError('请求参数无效。')
}

function ensureResponse<T>(value: T, guard: (candidate: unknown) => candidate is T): IpcResponse<T> {
  if (!guard(value)) throw new Error('Feedback service returned an invalid response')
  return success(value)
}

function mapFeedbackIpcError(error: unknown): IpcResponse<never> {
  if (error instanceof FeedbackIpcRequestError) {
    return failure(IPC_ERROR_CODES.INVALID_PAYLOAD, error.message)
  }
  if (error instanceof FeedbackServiceError) {
    return failure(IPC_ERROR_CODES.FEEDBACK_ERROR, error.message)
  }
  if (error instanceof AiGatewayError) {
    return failure(IPC_ERROR_CODES.AI_ERROR, error.message)
  }
  return failure(IPC_ERROR_CODES.INTERNAL_ERROR, '无法完成反馈操作，请稍后重试。')
}
