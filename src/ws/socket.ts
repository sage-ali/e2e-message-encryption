import type { ServerWsEvent, ClientWsEvent } from '../types/index.ts'
import { getAccessToken } from '../api/tokenStore.ts'

export type SocketStatus = 'disconnected' | 'connecting' | 'connected'

const WS_BASE = 'wss://whisperbox.koyeb.app'
const INITIAL_RECONNECT_DELAY = 1_000
const MAX_RECONNECT_DELAY = 30_000

// Valid discriminant values for ServerWsEvent — used to validate incoming frames.
const VALID_EVENTS = new Set(['message.receive', 'user.online', 'user.offline', 'error'])

// ── Module state ──────────────────────────────────────────────────────────────

let socket: WebSocket | null = null
let reconnectTimer: number | null = null
let reconnectDelay = INITIAL_RECONNECT_DELAY
let intentionalDisconnect = false
let currentStatus: SocketStatus = 'disconnected'

let onEventHandler: ((event: ServerWsEvent) => void) | null = null
let onStatusHandler: ((status: SocketStatus) => void) | null = null

// ── Public API ────────────────────────────────────────────────────────────────

/** Register a handler that receives every validated server event. */
export function onServerEvent(handler: (event: ServerWsEvent) => void): void {
  onEventHandler = handler
}

/** Register a handler that fires whenever the connection status changes. */
export function onStatusChange(handler: (status: SocketStatus) => void): void {
  onStatusHandler = handler
}

export function getStatus(): SocketStatus {
  return currentStatus
}

/**
 * Opens a WebSocket connection using the current access token.
 * No-ops if already connected or connecting.
 */
export function connect(): void {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return
  }
  const token = getAccessToken()
  if (!token) return
  intentionalDisconnect = false
  openSocket(token)
}

/** Closes the connection and stops any pending reconnect. */
export function disconnect(): void {
  intentionalDisconnect = true
  clearReconnectTimer()
  socket?.close(1000, 'Logout')
  socket = null
  setStatus('disconnected')
}

/**
 * Sends an encrypted message event over the WebSocket.
 * Returns false if the socket is not open — the caller should fall back to
 * POST /messages instead.
 */
export function sendEvent(event: ClientWsEvent): boolean {
  if (socket?.readyState !== WebSocket.OPEN) return false
  socket.send(JSON.stringify(event))
  return true
}

// ── Internal ──────────────────────────────────────────────────────────────────

function setStatus(next: SocketStatus): void {
  currentStatus = next
  onStatusHandler?.(next)
}

function openSocket(token: string): void {
  setStatus('connecting')
  const url = `${WS_BASE}/ws?token=${encodeURIComponent(token)}`
  socket = new WebSocket(url)

  socket.addEventListener('open', () => {
    reconnectDelay = INITIAL_RECONNECT_DELAY
    setStatus('connected')
  })

  socket.addEventListener('message', (event) => {
    // MessageEvent.data is typed `any` by the DOM — assign to unknown immediately.

    const raw: unknown = event.data
    if (typeof raw !== 'string') return
    const parsed = parseServerEvent(raw)
    if (parsed) onEventHandler?.(parsed)
  })

  socket.addEventListener('close', () => {
    socket = null
    setStatus('disconnected')
    if (!intentionalDisconnect) scheduleReconnect()
  })

  socket.addEventListener('error', () => {
    // 'error' always precedes 'close' — reconnection is handled in the close handler.
  })
}

function scheduleReconnect(): void {
  clearReconnectTimer()
  const delay = reconnectDelay
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    const token = getAccessToken()
    if (!token) return
    openSocket(token)
  }, delay)
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function isServerEvent(value: unknown): value is ServerWsEvent {
  if (typeof value !== 'object' || value === null || !('event' in value)) return false
  const record = value as Record<string, unknown>
  const eventType = record['event']
  return typeof eventType === 'string' && VALID_EVENTS.has(eventType)
}

function parseServerEvent(raw: string): ServerWsEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isServerEvent(parsed) ? parsed : null
  } catch {
    return null
  }
}
