import type React from 'react'
import { Navigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.ts'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps): React.JSX.Element {
  const session = useAuthStore((s) => s.session)
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
