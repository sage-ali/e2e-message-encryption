import type { Result, RefreshResponse } from '../types/index.ts'
import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from './tokenStore.ts'

export const BASE_URL = 'https://whisperbox.koyeb.app'

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(withBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {}
  const token = getAccessToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (withBody) headers['Content-Type'] = 'application/json'
  return headers
}

/** Type guard for the { detail: string } error shape the API returns. */
function hasDetail(body: unknown): body is { detail: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'detail' in body &&
    typeof (body as Record<string, unknown>)['detail'] === 'string'
  )
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (hasDetail(body)) return body.detail
  } catch {
    // response body was not JSON — fall through
  }
  return `Request failed (${response.status.toString()})`
}

// ── Silent token refresh ──────────────────────────────────────────────────────

async function tryRefresh(): Promise<boolean> {
  const token = getRefreshToken()
  if (!token) return false

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }),
    })

    if (!response.ok) {
      clearTokens()
      return false
    }

    // as-cast: external API boundary — server is documented to return RefreshResponse.
    const data = (await response.json()) as RefreshResponse
    setAccessToken(data.access_token)
    return true
  } catch {
    clearTokens()
    return false
  }
}

// ── Core request ──────────────────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit, retried = false): Promise<Result<T>> {
  try {
    const hasBody = init.body !== undefined
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { ...authHeaders(hasBody), ...(init.headers as Record<string, string> | undefined) },
    })

    if (response.status === 401 && !retried) {
      const refreshed = await tryRefresh()
      if (!refreshed) return { ok: false, error: 'Session expired. Please log in again.' }
      return await request<T>(path, init, true)
    }

    if (!response.ok) {
      const error = await parseErrorBody(response)
      return { ok: false, error }
    }

    // as-cast: external API boundary — callers declare T based on the documented response shape.
    const data = (await response.json()) as T
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' }
  }
}

// ── Public request helpers ────────────────────────────────────────────────────

export async function get<T>(path: string): Promise<Result<T>> {
  return request<T>(path, { method: 'GET' })
}

export async function post<T>(path: string, body: unknown): Promise<Result<T>> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export async function del<T>(path: string, body?: unknown): Promise<Result<T>> {
  return request<T>(path, {
    method: 'DELETE',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
