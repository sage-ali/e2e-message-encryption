import { create } from 'zustand'
import type {
  ConversationSummary,
  DecryptedMessage,
  MessageResponse,
  MessagePayload,
} from '../types/index.ts'
import { getConversations, getMessages as apiGetMessages } from '../api/messages.ts'
import { decryptMessage, getSession } from '../crypto/index.ts'
import useAuthStore from './authStore.ts'

interface ChatState {
  conversations: ConversationSummary[]
  messages: Record<string, DecryptedMessage[]> // userId -> messages
  onlinePresence: Record<string, boolean> // userId -> isOnline
  activeConversationId: string | null
  loading: boolean
  error: string | null

  fetchConversations: () => Promise<void>
  fetchMessages: (userId: string) => Promise<void>
  addMessage: (userId: string, message: MessageResponse) => Promise<void>
  setPresence: (userId: string, isOnline: boolean) => void
  setActiveConversation: (userId: string | null) => void
  upsertConversation: (userId: string, username: string, displayName: string) => void
  clearChat: () => void
}

/**
 * Helper to decrypt a MessageResponse into a DecryptedMessage.
 * Swaps encryptedKeyForSelf if the current user is the sender.
 */
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
      plaintext: '🔒 Could not decrypt message',
      created_at: msg.created_at,
      decrypted: false,
    }
  }
}

const useChatStore = create<ChatState>((set) => ({
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
    const user = useAuthStore.getState().user
    if (!session || !user) return

    set({ loading: true, error: null })
    const result = await apiGetMessages(userId)

    if (result.ok) {
      const decrypted = await Promise.all(
        result.data.map((msg) => decryptResponse(msg, user.id, session.privateKey)),
      )
      set((state) => ({
        messages: {
          ...state.messages,
          [userId]: decrypted,
        },
        loading: false,
      }))
    } else {
      set({ error: result.error, loading: false })
    }
  },

  addMessage: async (userId: string, message: MessageResponse) => {
    const session = getSession()
    const user = useAuthStore.getState().user
    if (!session || !user) return

    const decrypted = await decryptResponse(message, user.id, session.privateKey)

    set((state) => {
      const existing = state.messages[userId] || []
      // Avoid duplicates if WS and HTTP race (though unlikely here)
      if (existing.some((m) => m.id === decrypted.id)) return state

      return {
        messages: {
          ...state.messages,
          [userId]: [...existing, decrypted],
        },
        // Also update conversation's last_message_at if it exists
        conversations: state.conversations.map((c) =>
          c.user_id === userId ? { ...c, last_message_at: message.created_at } : c,
        ),
      }
    })
  },

  setPresence: (userId: string, isOnline: boolean) => {
    set((state) => ({
      onlinePresence: {
        ...state.onlinePresence,
        [userId]: isOnline,
      },
    }))
  },

  setActiveConversation: (userId: string | null) => {
    set({ activeConversationId: userId })
  },

  upsertConversation: (userId: string, username: string, displayName: string) => {
    set((state) => {
      const exists = state.conversations.some((c) => c.user_id === userId)
      if (exists) return state

      const newConv: ConversationSummary = {
        user_id: userId,
        username,
        display_name: displayName,
        last_message_at: new Date().toISOString(),
      }

      return {
        conversations: [newConv, ...state.conversations],
      }
    })
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
}))

// Clear chat state when user logs out
useAuthStore.subscribe((state, prevState) => {
  if (prevState.user && !state.user) {
    useChatStore.getState().clearChat()
  }
})

export default useChatStore
