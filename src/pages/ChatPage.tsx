import { useEffect } from 'react'
import Sidebar from '../components/chat/Sidebar.tsx'
import MessageThread from '../components/chat/MessageThread.tsx'
import MessageInput from '../components/chat/MessageInput.tsx'
import useChatStore from '../store/chatStore.ts'

export default function ChatPage(): React.JSX.Element {
  const { error, clearError } = useChatStore()

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError()
      }, 5000)
      return () => {
        clearTimeout(timer)
      }
    }
  }, [error, clearError])

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <Sidebar />

      <main className="flex flex-1 flex-col relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm shadow-xl">
            {error}
          </div>
        )}

        <MessageThread />
        <MessageInput />
      </main>
    </div>
  )
}
