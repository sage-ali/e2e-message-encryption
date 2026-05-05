import { create } from 'zustand'
import type { UserProfile, Result } from '../types/index.ts'
import type { CryptoSession } from '../types/index.ts'
import {
  buildKeyPairBundle,
  restoreCryptoSession,
  setSession,
  clearSession,
} from '../crypto/index.ts'
import { register as apiRegister, login as apiLogin, logout as apiLogout } from '../api/auth.ts'
import { onTokensCleared } from '../api/tokenStore.ts'

interface AuthState {
  user: UserProfile | null
  session: CryptoSession | null
  registerUser: (
    username: string,
    displayName: string,
    password: string,
  ) => Promise<Result<undefined>>
  loginUser: (username: string, password: string) => Promise<Result<undefined>>
  logoutUser: () => Promise<void>
  clearAuth: () => void
}

const useAuthStore = create<AuthState>((set) => {
  // When the API client clears tokens (expired session), clear auth state too.
  onTokensCleared(() => {
    clearSession()
    set({ user: null, session: null })
  })

  return {
    user: null,
    session: null,

    async registerUser(username, displayName, password) {
      let bundle
      try {
        bundle = await buildKeyPairBundle(password)
      } catch {
        return { ok: false, error: 'Failed to generate encryption keys. Please try again.' }
      }

      const result = await apiRegister({
        username,
        display_name: displayName,
        password,
        public_key: bundle.publicKeyBase64,
        wrapped_private_key: bundle.wrappedPrivateKeyBase64,
        pbkdf2_salt: bundle.pbkdf2SaltBase64,
      })

      if (!result.ok) return result

      let cryptoSession: CryptoSession
      try {
        cryptoSession = await restoreCryptoSession(result.data.user, password)
      } catch {
        // Account was created but session could not start — redirect to login.
        return {
          ok: false,
          error: 'Account created. Please log in to continue.',
        }
      }

      setSession(cryptoSession)
      set({ user: result.data.user, session: cryptoSession })
      return { ok: true, data: undefined }
    },

    async loginUser(username, password) {
      const result = await apiLogin({ username, password })
      if (!result.ok) return result

      let cryptoSession: CryptoSession
      try {
        cryptoSession = await restoreCryptoSession(result.data.user, password)
      } catch {
        return {
          ok: false,
          error: 'Could not unlock your encryption keys. Check your password and try again.',
        }
      }

      setSession(cryptoSession)
      set({ user: result.data.user, session: cryptoSession })
      return { ok: true, data: undefined }
    },

    async logoutUser() {
      await apiLogout()
      clearSession()
      set({ user: null, session: null })
    },

    clearAuth() {
      clearSession()
      set({ user: null, session: null })
    },
  }
})

export default useAuthStore
