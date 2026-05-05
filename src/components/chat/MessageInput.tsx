import type React from 'react'
import { useState } from 'react'
import useChatStore from '../../store/chatStore.ts'

export default function MessageInput(): React.JSX.Element | null {
  const { activeConversationId, sendMessage } = useChatStore()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const MAX_LENGTH = 2000

  if (!activeConversationId) return null

  const handleSend = async (e: React.BaseSyntheticEvent): Promise<void> => {
    e.preventDefault()
    if (!text.trim() || sending || text.length > MAX_LENGTH) return

    setSending(true)
    try {
      await sendMessage(activeConversationId, text.trim())
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSend(e)
      }}
      className="border-t border-gray-800 bg-gray-900 p-4"
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, MAX_LENGTH))
            }}
            placeholder="Type a message..."
            className="flex-1 rounded-full bg-gray-800 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 outline-hidden focus:ring-2 focus:ring-blue-600 transition-all"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending || text.length > MAX_LENGTH}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500"
          >
            {sending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            )}
          </button>
        </div>
        {text.length > MAX_LENGTH * 0.8 && (
          <p
            className={`text-right text-[10px] ${
              text.length >= MAX_LENGTH ? 'text-red-500' : 'text-gray-500'
            }`}
          >
            {text.length}/{MAX_LENGTH}
          </p>
        )}
      </div>
    </form>
  )
}
