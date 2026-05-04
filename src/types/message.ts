/**
 * The encrypted blob stored on the server.
 * All four fields are base64-encoded binary.
 *
 * ciphertext         — AES-GCM encrypted plaintext
 * iv                 — 96-bit nonce used for AES-GCM
 * encryptedKey       — AES key wrapped with the recipient's RSA public key
 * encryptedKeyForSelf — AES key wrapped with the sender's own RSA public key
 */
export interface MessagePayload {
  ciphertext: string
  iv: string
  encryptedKey: string
  encryptedKeyForSelf: string
}

export interface MessageResponse {
  id: string
  from_user_id: string
  to_user_id: string
  payload: MessagePayload
  delivered: boolean
  created_at: string
}

export interface ConversationSummary {
  user_id: string
  username: string
  display_name: string
  last_message_at: string
}

export interface SendMessageRequest {
  to: string
  payload: MessagePayload
}

export interface MessageHistoryParams {
  limit?: number
  before?: string
}

/** A message after decryption — ready for the UI to render */
export interface DecryptedMessage {
  id: string
  from_user_id: string
  to_user_id: string
  plaintext: string
  created_at: string
  /** true if decryption succeeded, false if it failed gracefully */
  decrypted: boolean
}
