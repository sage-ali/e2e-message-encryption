import type React from 'react'
import { useEffect } from 'react'
import useChatStore from '../../store/chatStore.ts'
import useAuthStore from '../../store/authStore.ts'
import UserSearch from './UserSearch.tsx'

export default function Sidebar(): React.JSX.Element {
  const {
    conversations,
    fetchConversations,
    activeConversationId,
    setActiveConversation,
    onlinePresence,
    loading,
  } = useChatStore()
  const currentUser = useAuthStore((s) => s.user)
  const logoutUser = useAuthStore((s) => s.logoutUser)

  useEffect(() => {
    void fetchConversations()
  }, [fetchConversations])

  return (
    <div className="flex h-full w-80 flex-col border-r border-gray-800 bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 p-4">
        <h1 className="text-xl font-bold text-gray-100">WhisperBox</h1>
        <button
          onClick={() => {
            void logoutUser()
          }}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Logout
        </button>
      </div>

      <UserSearch />

      {/* User Info */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
            {currentUser?.display_name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="truncate font-medium text-gray-200">{currentUser?.display_name}</p>
            <p className="truncate text-xs text-gray-500">@{currentUser?.username}</p>
          </div>
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto p-2">
        <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
          Messages
        </h2>
        <div className="space-y-1">
          {loading && conversations.length === 0 ? (
            // Loading Skeletons
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 rounded-lg px-3 py-2">
                <div className="h-10 w-10 rounded-full bg-gray-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded-full bg-gray-800" />
                  <div className="h-2 w-32 rounded-full bg-gray-800" />
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-gray-600">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.user_id}
                onClick={() => {
                  setActiveConversation(conv.user_id)
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  activeConversationId === conv.user_id ? 'bg-gray-800' : 'hover:bg-gray-900'
                }`}
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-700 font-medium text-gray-300">
                    {conv.display_name.charAt(0).toUpperCase()}
                  </div>
                  {onlinePresence[conv.user_id] && (
                    <div className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-gray-950 bg-green-500" />
                  )}
                </div>
                <div className="flex-1 overflow-hidden text-left">
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium text-gray-200">{conv.display_name}</span>
                    <span className="text-[10px] text-gray-600">
                      {new Date(conv.last_message_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500">@{conv.username}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
