import type React from 'react'
import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore.ts'
import Button from '../components/ui/Button.tsx'
import Input from '../components/ui/Input.tsx'

export default function RegisterPage(): React.JSX.Element {
  const session = useAuthStore((s) => s.session)
  const registerUser = useAuthStore((s) => s.registerUser)
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  function validate(): boolean {
    const next: Record<string, string> = {}

    if (!displayName.trim()) next['displayName'] = 'Display name is required.'
    if (username.trim().length < 3) next['username'] = 'Username must be at least 3 characters.'
    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim()))
      next['username'] = 'Only letters, numbers, _ and - are allowed.'
    if (password.length < 8) next['password'] = 'Password must be at least 8 characters.'
    if (password !== confirmPassword) next['confirmPassword'] = 'Passwords do not match.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(): Promise<void> {
    setFormError(undefined)
    if (!validate()) return

    setLoading(true)
    const result = await registerUser(username.trim().toLowerCase(), displayName.trim(), password)
    setLoading(false)

    if (!result.ok) {
      setFormError(result.error)
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
          <h2 className="mb-6 text-lg font-semibold text-gray-100">Create account</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSubmit()
            }}
            noValidate
            className="flex flex-col gap-4"
          >
            <Input
              id="displayName"
              label="Display name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Alice"
              autoComplete="name"
              disabled={loading}
              error={errors['displayName']}
            />
            <Input
              id="username"
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="alice_92"
              autoComplete="username"
              disabled={loading}
              error={errors['username']}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={loading}
              error={errors['password']}
            />
            <Input
              id="confirmPassword"
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={loading}
              error={errors['confirmPassword']}
            />

            {formError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</p>
            )}

            <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-3 py-2">
              <p className="text-xs text-emerald-400">
                🔑 Encryption keys will be generated from your password. If you forget your
                password, your messages cannot be recovered.
              </p>
            </div>

            <Button type="submit" fullWidth loading={loading}>
              {loading ? 'Generating keys…' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300">
              Sign in
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
