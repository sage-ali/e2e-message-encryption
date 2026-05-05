import type {
  Result,
  ConversationSummary,
  MessageResponse,
  SendMessageRequest,
  MessageHistoryParams,
} from '../types/index.ts'
import { get, post } from './client.ts'

export async function getConversations(): Promise<Result<ConversationSummary[]>> {
  return get<ConversationSummary[]>('/conversations')
}

export async function getMessages(
  userId: string,
  params?: MessageHistoryParams,
): Promise<Result<MessageResponse[]>> {
  const query = new URLSearchParams()
  if (params?.limit !== undefined) query.set('limit', params.limit.toString())
  if (params?.before !== undefined) query.set('before', params.before)
  const qs = query.size > 0 ? `?${query.toString()}` : ''
  return get<MessageResponse[]>(`/conversations/${encodeURIComponent(userId)}/messages${qs}`)
}

/** Offline fallback — use the WebSocket for real-time delivery instead. */
export async function sendMessage(req: SendMessageRequest): Promise<Result<MessageResponse>> {
  return post<MessageResponse>('/messages', req)
}
