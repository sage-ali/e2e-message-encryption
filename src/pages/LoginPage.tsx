import type React from 'react'
import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore.ts'
import Button from '../components/ui/Button.tsx'
import Input from '../components/ui/Input.tsx'

export default function LoginPage(): React.JSX.Element {
  const session = useAuthStore((s) => s.session)
  const loginUser = useAuthStore((s) => s.loginUser)
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(): Promise<void> {
    setError(undefined)

    if (!username.trim() || !password) {
      setError('Please fill in all fields.')
      return
    }

    setLoading(true)
    const result = await loginUser(username.trim().toLowerCase(), password)
    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    void navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
              <svg
                className="h-7 w-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">WhisperBox</h1>
          <p className="mt-1 text-sm text-gray-500">End-to-end encrypted messaging</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <h2 className="mb-6 text-lg font-semibold text-gray-100">Sign in</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSubmit()
            }}
            noValidate
            className="flex flex-col gap-4"
          >
            <Input
              id="username"
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="your_username"
              autoComplete="username"
              disabled={loading}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            No account?{' '}
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300">
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-600">
          🔒 Your messages are encrypted on your device. WhisperBox cannot read them.
        </p>
      </div>
    </div>
  )
}
