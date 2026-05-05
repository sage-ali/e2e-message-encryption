import { useEffect, useState } from 'react'
import Sidebar from '../components/chat/Sidebar.tsx'
import MessageThread from '../components/chat/MessageThread.tsx'
import MessageInput from '../components/chat/MessageInput.tsx'
import useChatStore from '../store/chatStore.ts'
import { onStatusChange, getStatus, type SocketStatus } from '../ws/index.ts'

export default function ChatPage(): React.JSX.Element {
  const { error, clearError } = useChatStore()
  const [wsStatus, setWsStatus] = useState<SocketStatus>(getStatus())

  useEffect(() => {
    onStatusChange(setWsStatus)
  }, [])

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
        {wsStatus === 'connecting' && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-blue-600/20 text-blue-400 text-[10px] text-center py-0.5 animate-pulse">
            Connecting to real-time server...
          </div>
        )}
        {wsStatus === 'disconnected' && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-red-600/20 text-red-400 text-[10px] text-center py-0.5">
            Disconnected. Messages will fall back to HTTP.
          </div>
        )}

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
