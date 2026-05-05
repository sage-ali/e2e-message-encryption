import type React from 'react'
import { useEffect, useRef, useMemo } from 'react'
import useChatStore from '../../store/chatStore.ts'
import useAuthStore from '../../store/authStore.ts'

export default function MessageThread(): React.JSX.Element {
  const { activeConversationId, messages, fetchMessages, conversations, loading } = useChatStore()
  const currentUser = useAuthStore((s) => s.user)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeMessages = useMemo(() => {
    return activeConversationId ? (messages[activeConversationId] ?? []) : []
  }, [activeConversationId, messages])

  const activePartner = conversations.find((c) => c.user_id === activeConversationId)

  useEffect(() => {
    if (activeConversationId) {
      void fetchMessages(activeConversationId)
    }
  }, [activeConversationId, fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  if (!activeConversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-900 text-gray-500">
        <div className="mb-4 text-6xl">💬</div>
        <p>Select a conversation to start chatting</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-900">
      {/* Thread Header */}
      <div className="flex items-center gap-3 border-b border-gray-800 p-4 bg-gray-900/50 backdrop-blur-md">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 font-bold text-gray-200">
          {activePartner?.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="font-bold text-gray-100">{activePartner?.display_name}</h2>
          <p className="text-xs text-gray-500">@{activePartner?.username}</p>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && activeMessages.length === 0 ? (
          // Loading Skeletons
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`flex flex-col ${i % 2 === 0 ? 'items-end' : 'items-start'} animate-pulse`}
            >
              <div
                className={`h-12 w-48 rounded-2xl bg-gray-800 ${
                  i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'
                }`}
              />
            </div>
          ))
        ) : activeMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-600">
            <p className="rounded-full bg-gray-800 px-4 py-2 text-sm italic">
              Messages are end-to-end encrypted.
            </p>
          </div>
        ) : (
          activeMessages.map((msg) => {
            const isMe = msg.from_user_id === currentUser?.id
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-gray-800 text-gray-100 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.plaintext}</p>
                  <div
                    className={`mt-1 flex items-center gap-1 text-[10px] ${isMe ? 'text-blue-200' : 'text-gray-500'}`}
                  >
                    <span>
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {!msg.decrypted && <span title="Decryption failed">⚠️</span>}
                    {msg.decrypted && <span title="End-to-end encrypted">🔒</span>}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
