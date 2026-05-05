import type {
  Result,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserProfile,
} from '../types/index.ts'
import { get, post } from './client.ts'
import { setTokens, getRefreshToken, clearTokens } from './tokenStore.ts'

export async function register(req: RegisterRequest): Promise<Result<AuthResponse>> {
  const result = await post<AuthResponse>('/auth/register', req)
  if (result.ok) setTokens(result.data.access_token, result.data.refresh_token)
  return result
}

export async function login(req: LoginRequest): Promise<Result<AuthResponse>> {
  const result = await post<AuthResponse>('/auth/login', req)
  if (result.ok) setTokens(result.data.access_token, result.data.refresh_token)
  return result
}

export async function getMe(): Promise<Result<UserProfile>> {
  return get<UserProfile>('/auth/me')
}

export async function logout(): Promise<Result<undefined>> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearTokens()
    return { ok: true, data: undefined }
  }
  const result = await post<undefined>('/auth/logout', { refresh_token: refreshToken })
  clearTokens()
  return result
}
