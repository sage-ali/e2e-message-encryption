import type React from 'react'
import useAuthStore from '../store/authStore.ts'
import Button from '../components/ui/Button.tsx'

export default function ChatPage(): React.JSX.Element {
  const user = useAuthStore((s) => s.user)
  const logoutUser = useAuthStore((s) => s.logoutUser)

  async function handleLogout(): Promise<void> {
    await logoutUser()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <p className="text-gray-400">
          Signed in as{' '}
          <span className="font-medium text-gray-100">{user?.display_name ?? 'Unknown'}</span>
        </p>
        <p className="mt-1 text-sm text-gray-600">Chat UI coming in Phase 7</p>
        <div className="mt-6">
          <Button variant="ghost" onClick={() => void handleLogout()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
