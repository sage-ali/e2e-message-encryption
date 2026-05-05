import { create } from 'zustand'
import type {
  ConversationSummary,
  DecryptedMessage,
  MessageResponse,
  MessagePayload,
} from '../types/index.ts'
import {
  getConversations,
  getMessages as apiGetMessages,
  sendMessage as apiSendMessage,
} from '../api/messages.ts'
import { getUserPublicKey } from '../api/users.ts'
import { decryptMessage, encryptMessage, getSession, importPublicKey } from '../crypto/index.ts'
import { sendEvent } from '../ws/index.ts'
import { onTokensCleared } from '../api/tokenStore.ts'

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
    set({
      conversations: [],
      messages: {},
      onlinePresence: {},
      activeConversationId: null,
      error: null,
    })
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

      const pubKeyResult = await getUserPublicKey(userId)
      if (!pubKeyResult.ok) {
        set({ error: 'Could not fetch recipient public key.' })
        return
      }

      let recipientPubKey: CryptoKey
      try {
        recipientPubKey = await importPublicKey(pubKeyResult.data.public_key)
      } catch {
        set({ error: 'Failed to import recipient public key.' })
        return
      }

      let payload: MessagePayload
      try {
        payload = await encryptMessage(plaintext, recipientPubKey, session.publicKey)
      } catch {
        set({ error: 'Encryption failed. Please try again.' })
        return
      }

      const sentViaWs = sendEvent({ event: 'message.send', to: userId, payload })

      if (!sentViaWs) {
        const result = await apiSendMessage({ to: userId, payload })
        if (!result.ok) {
          set({ error: result.error })
        } else {
          await get().addMessage(userId, result.data)
        }
      }
      // If sent via WS, the server will push back a message.receive event
      // which the WS handler will add to state.
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
