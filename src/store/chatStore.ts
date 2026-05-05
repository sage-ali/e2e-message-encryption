import { create } from 'zustand'
import type {
  ConversationSummary,
  DecryptedMessage,
  MessageResponse,
  MessagePayload,
  ServerWsEvent,
} from '../types/index.ts'
import {
  getConversations,
  getMessages as apiGetMessages,
  sendMessage as apiSendMessage,
} from '../api/messages.ts'
import { getUserPublicKey } from '../api/users.ts'
import { decryptMessage, encryptMessage, getSession, importPublicKey } from '../crypto/index.ts'
import { sendEvent, onServerEvent } from '../ws/index.ts'
import { onTokensCleared } from '../api/tokenStore.ts'

// Caches imported CryptoKey objects for the session so we don't hit the API on every send.
const pubKeyCache = new Map<string, CryptoKey>()

async function getOrFetchPubKey(userId: string): Promise<CryptoKey | null> {
  const cached = pubKeyCache.get(userId)
  if (cached !== undefined) return cached

  const result = await getUserPublicKey(userId)
  if (!result.ok) return null

  try {
    const key = await importPublicKey(result.data.public_key)
    pubKeyCache.set(userId, key)
    return key
  } catch {
    return null
  }
}

interface ChatState {
  conversations: ConversationSummary[]
  messages: Record<string, DecryptedMessage[]>
  onlinePresence: Record<string, boolean>
  activeConversationId: string | null
  loading: boolean
  error: string | null

  fetchConversations: () => Promise<void>
  fetchMessages: (userId: string) => Promise<void>
  sendMessage: (userId: string, plaintext: string) => Promise<void>
  addMessage: (userId: string, message: MessageResponse) => Promise<void>
  setPresence: (userId: string, isOnline: boolean) => void
  setActiveConversation: (userId: string | null) => void
  upsertConversation: (userId: string, username: string, displayName: string) => void
  clearError: () => void
  clearChat: () => void
}

async function decryptResponse(
  msg: MessageResponse,
  currentUserId: string,
  privateKey: CryptoKey,
): Promise<DecryptedMessage> {
  const isSentByMe = msg.from_user_id === currentUserId

  // Sender must use encryptedKeyForSelf — they wrapped the AES key with their own public key.
  const payload: MessagePayload = {
    ...msg.payload,
    encryptedKey: isSentByMe ? msg.payload.encryptedKeyForSelf : msg.payload.encryptedKey,
  }

  try {
    const plaintext = await decryptMessage(payload, privateKey)
    return {
      id: msg.id,
      from_user_id: msg.from_user_id,
      to_user_id: msg.to_user_id,
      plaintext,
      created_at: msg.created_at,
      decrypted: true,
    }
  } catch (err) {
    console.error('Decryption failed for message:', msg.id, err)
    return {
      id: msg.id,
      from_user_id: msg.from_user_id,
      to_user_id: msg.to_user_id,
      plaintext: '[Could not decrypt]',
      created_at: msg.created_at,
      decrypted: false,
    }
  }
}

const useChatStore = create<ChatState>((set, get) => {
  onTokensCleared(() => {
    pubKeyCache.clear()
    set({
      conversations: [],
      messages: {},
      onlinePresence: {},
      activeConversationId: null,
      error: null,
    })
  })

  // ── WebSocket event handler ────────────────────────────────────────────────
  // Declared as a function (not arrow) so it's hoisted and available above.
  async function handleWsEvent(event: ServerWsEvent): Promise<void> {
    if (event.event === 'message.receive') {
      const session = getSession()
      if (!session) return

      // The peer is whoever is "not me" in the exchange.
      const peerId = event.from_user_id === session.userId ? event.to_user_id : event.from_user_id

      const msgResponse: MessageResponse = {
        id: event.id,
        from_user_id: event.from_user_id,
        to_user_id: event.to_user_id,
        payload: event.payload,
        delivered: true,
        created_at: event.created_at,
      }

      const decrypted = await decryptResponse(msgResponse, session.userId, session.privateKey)

      set((state) => {
        const existing = state.messages[peerId] ?? []

        // Skip if this real ID is already in state (e.g. HTTP path already added it).
        if (existing.some((m) => m.id === decrypted.id)) return state

        // Echo of our own WS-sent message — replace the oldest optimistic placeholder.
        if (event.from_user_id === session.userId) {
          const optIdx = existing.findIndex((m) => m.id.startsWith('opt_'))
          if (optIdx !== -1) {
            const updated = [...existing]
            updated[optIdx] = decrypted
            return {
              messages: { ...state.messages, [peerId]: updated },
              conversations: state.conversations.map((c) =>
                c.user_id === peerId ? { ...c, last_message_at: event.created_at } : c,
              ),
            }
          }
        }

        return {
          messages: { ...state.messages, [peerId]: [...existing, decrypted] },
          conversations: state.conversations.map((c) =>
            c.user_id === peerId ? { ...c, last_message_at: event.created_at } : c,
          ),
        }
      })
    } else if (event.event === 'user.online') {
      get().setPresence(event.user_id, true)
    } else if (event.event === 'user.offline') {
      get().setPresence(event.user_id, false)
    }
  }

  onServerEvent((event) => {
    void handleWsEvent(event)
  })

  return {
    conversations: [],
    messages: {},
    onlinePresence: {},
    activeConversationId: null,
    loading: false,
    error: null,

    fetchConversations: async () => {
      set({ loading: true, error: null })
      const result = await getConversations()
      if (result.ok) {
        set({ conversations: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    },

    fetchMessages: async (userId: string) => {
      const session = getSession()
      if (!session) return

      set({ loading: true, error: null })
      const result = await apiGetMessages(userId)

      if (result.ok) {
        const decrypted = await Promise.all(
          result.data.map((msg) => decryptResponse(msg, session.userId, session.privateKey)),
        )
        // API returns newest-first; sort ascending so oldest renders at the top.
        decrypted.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        set((state) => ({
          messages: { ...state.messages, [userId]: decrypted },
          loading: false,
        }))
      } else {
        set({ error: result.error, loading: false })
      }
    },

    sendMessage: async (userId: string, plaintext: string) => {
      const session = getSession()
      if (!session) return

      // Fetch recipient key once; subsequent sends use the cache.
      const recipientPubKey = await getOrFetchPubKey(userId)
      if (!recipientPubKey) {
        set({ error: 'Could not fetch recipient public key.' })
        return
      }

      let payload: MessagePayload
      try {
        payload = await encryptMessage(plaintext, recipientPubKey, session.publicKey)
      } catch {
        set({ error: 'Encryption failed. Please try again.' })
        return
      }

      // Show the message immediately — don't wait for the server.
      const optimisticId = `opt_${crypto.randomUUID()}`
      set((state) => ({
        messages: {
          ...state.messages,
          [userId]: [
            ...(state.messages[userId] ?? []),
            {
              id: optimisticId,
              from_user_id: session.userId,
              to_user_id: userId,
              plaintext,
              created_at: new Date().toISOString(),
              decrypted: true,
            },
          ],
        },
      }))

      const sentViaWs = sendEvent({ event: 'message.send', to: userId, payload })

      if (!sentViaWs) {
        // HTTP fallback — replace the optimistic entry once the server confirms.
        const result = await apiSendMessage({ to: userId, payload })
        if (result.ok) {
          const confirmed = await decryptResponse(result.data, session.userId, session.privateKey)
          set((state) => ({
            messages: {
              ...state.messages,
              [userId]: (state.messages[userId] ?? []).map((m) =>
                m.id === optimisticId ? confirmed : m,
              ),
            },
          }))
        } else {
          // Remove the optimistic entry and surface the error.
          set((state) => ({
            messages: {
              ...state.messages,
              [userId]: (state.messages[userId] ?? []).filter((m) => m.id !== optimisticId),
            },
            error: result.error,
          }))
        }
      }
      // WS path: the server echo arrives as message.receive and replaces the optimistic entry.
    },

    addMessage: async (userId: string, message: MessageResponse) => {
      const session = getSession()
      if (!session) return

      const decrypted = await decryptResponse(message, session.userId, session.privateKey)

      set((state) => {
        const existing = state.messages[userId] ?? []
        if (existing.some((m) => m.id === decrypted.id)) return state

        return {
          messages: { ...state.messages, [userId]: [...existing, decrypted] },
          conversations: state.conversations.map((c) =>
            c.user_id === userId ? { ...c, last_message_at: message.created_at } : c,
          ),
        }
      })
    },

    setPresence: (userId: string, isOnline: boolean) => {
      set((state) => ({
        onlinePresence: { ...state.onlinePresence, [userId]: isOnline },
      }))
    },

    setActiveConversation: (userId: string | null) => {
      set({ activeConversationId: userId })
    },

    upsertConversation: (userId: string, username: string, displayName: string) => {
      set((state) => {
        if (state.conversations.some((c) => c.user_id === userId)) return state

        const newConv: ConversationSummary = {
          user_id: userId,
          username,
          display_name: displayName,
          last_message_at: new Date().toISOString(),
        }
        return { conversations: [newConv, ...state.conversations] }
      })
    },

    clearError: () => {
      set({ error: null })
    },

    clearChat: () => {
      pubKeyCache.clear()
      set({
        conversations: [],
        messages: {},
        onlinePresence: {},
        activeConversationId: null,
        error: null,
      })
    },
  }
})

export default useChatStore
