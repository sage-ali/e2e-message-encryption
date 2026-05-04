import type { MessagePayload } from './message.ts'

// ── Client → Server ──────────────────────────────────────────────────────────

export interface WsSendEvent {
  event: 'message.send'
  to: string
  payload: MessagePayload
}

export type ClientWsEvent = WsSendEvent

// ── Server → Client ──────────────────────────────────────────────────────────

export interface WsMessageReceiveEvent {
  event: 'message.receive'
  id: string
  from_user_id: string
  to_user_id: string
  payload: MessagePayload
  created_at: string
}

export interface WsUserOnlineEvent {
  event: 'user.online'
  user_id: string
}

export interface WsUserOfflineEvent {
  event: 'user.offline'
  user_id: string
}

export interface WsErrorEvent {
  event: 'error'
  detail: string
}

export type ServerWsEvent =
  | WsMessageReceiveEvent
  | WsUserOnlineEvent
  | WsUserOfflineEvent
  | WsErrorEvent
