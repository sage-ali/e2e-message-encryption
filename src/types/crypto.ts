/**
 * Holds the live CryptoKey objects for the authenticated user.
 * Lives only in memory — never serialised or written to storage.
 * Cleared on logout.
 */
export interface CryptoSession {
  privateKey: CryptoKey
  publicKey: CryptoKey
  userId: string
}

/**
 * The key material generated during registration.
 * All strings are base64-encoded.
 * Sent to the server once; retrieved on every login to re-derive the session.
 */
export interface KeyPairBundle {
  publicKeyBase64: string
  wrappedPrivateKeyBase64: string
  pbkdf2SaltBase64: string
}
