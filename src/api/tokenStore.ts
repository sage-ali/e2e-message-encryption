let accessToken: string | null = null
let refreshToken: string | null = null

/** Called by the auth store when the session expires, so it can clear user state. */
let onClearedCallback: (() => void) | null = null

export function setTokens(access: string, refresh: string): void {
  accessToken = access
  refreshToken = refresh
}

export function setAccessToken(token: string): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  return refreshToken
}

export function clearTokens(): void {
  accessToken = null
  refreshToken = null
  if (onClearedCallback) onClearedCallback()
}

/** Register a callback that fires when tokens are cleared (e.g. session expires). */
export function onTokensCleared(cb: () => void): void {
  onClearedCallback = cb
}
