import { onServerEvent } from './socket.ts'
import useChatStore from '../store/chatStore.ts'
import useAuthStore from '../store/authStore.ts'
import type { MessageResponse } from '../types/index.ts'

export function setupWsHandlers(): void {
  onServerEvent((event) => {
    const { addMessage, setPresence } = useChatStore.getState()
    const { user } = useAuthStore.getState()

    if (!user) return

    switch (event.event) {
      case 'message.receive': {
        const message: MessageResponse = {
          id: event.id,
          from_user_id: event.from_user_id,
          to_user_id: event.to_user_id,
          payload: event.payload,
          delivered: true,
          created_at: event.created_at,
        }

        const otherUserId = event.from_user_id === user.id ? event.to_user_id : event.from_user_id

        void addMessage(otherUserId, message)
        break
      }
      case 'user.online':
        setPresence(event.user_id, true)
        break
      case 'user.offline':
        setPresence(event.user_id, false)
        break
      case 'error':
        console.error('WebSocket error:', event.detail)
        break
    }
  })
}
