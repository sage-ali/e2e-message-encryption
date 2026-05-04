import type { CryptoSession } from '../types/index.ts'

let activeSession: CryptoSession | null = null

export function setSession(session: CryptoSession): void {
  activeSession = session
}

export function getSession(): CryptoSession | null {
  return activeSession
}

/** Called on logout. Removes the private key from memory. */
export function clearSession(): void {
  activeSession = null
}
