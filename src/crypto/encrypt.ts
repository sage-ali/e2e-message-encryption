import type { MessagePayload } from '../types/index.ts'
import { bufferToBase64, base64ToBuffer } from './utils.ts'

/**
 * Encrypts a plaintext message for a recipient.
 *
 * Steps:
 * 1. Generate a fresh 256-bit AES-GCM key and 96-bit IV.
 * 2. Encrypt the plaintext with AES-GCM.
 * 3. Wrap the AES key with the recipient's RSA public key  → encryptedKey.
 * 4. Wrap the AES key with the sender's own RSA public key → encryptedKeyForSelf.
 *
 * The server receives only the encrypted output — it never sees the AES key
 * or the plaintext.
 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: CryptoKey,
  senderPublicKey: CryptoKey,
): Promise<MessagePayload> {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])

  const iv = crypto.getRandomValues(new Uint8Array(12))

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(plaintext),
  )

  const encryptedKeyBuffer = await crypto.subtle.wrapKey(
    'raw',
    aesKey,
    recipientPublicKey,
    'RSA-OAEP',
  )

  const encryptedKeyForSelfBuffer = await crypto.subtle.wrapKey(
    'raw',
    aesKey,
    senderPublicKey,
    'RSA-OAEP',
  )

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv),
    encryptedKey: bufferToBase64(encryptedKeyBuffer),
    encryptedKeyForSelf: bufferToBase64(encryptedKeyForSelfBuffer),
  }
}

/**
 * Decrypts a message received from the server.
 *
 * The caller passes the payload as-is for received messages, or swaps
 * `encryptedKey` for `encryptedKeyForSelf` when reading their own sent messages.
 *
 * Throws a DOMException if the private key does not match — callers must
 * handle this and show a graceful "could not decrypt" UI rather than crashing.
 */
export async function decryptMessage(
  payload: MessagePayload,
  privateKey: CryptoKey,
): Promise<string> {
  const aesKey = await crypto.subtle.unwrapKey(
    'raw',
    base64ToBuffer(payload.encryptedKey),
    privateKey,
    'RSA-OAEP',
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(payload.iv) },
    aesKey,
    base64ToBuffer(payload.ciphertext),
  )

  return new TextDecoder().decode(plaintextBuffer)
}
