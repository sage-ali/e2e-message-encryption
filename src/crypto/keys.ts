import type { KeyPairBundle, CryptoSession, UserProfile } from '../types/index.ts'
import { bufferToBase64, base64ToBuffer } from './utils.ts'

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

const PBKDF2_ITERATIONS = 100_000

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_PARAMS, true, ['wrapKey', 'unwrapKey'])
}

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Derives a 256-bit AES-GCM key from a password + salt via PBKDF2.
 * We use AES-GCM rather than AES-KW because Node.js's Web Crypto does not
 * support AES-KW wrapping of RSA PKCS#8 keys. AES-GCM provides the same
 * authenticated-encryption guarantee.
 */
export async function deriveWrappingKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    base64ToBuffer(base64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey'],
  )
}

/**
 * Generates a keypair, derives a wrapping key from the password, and encrypts
 * the private key bytes with AES-GCM. Returns everything as base64 strings
 * ready for the register API call.
 *
 * wrappedPrivateKeyBase64 encodes: [12-byte IV | AES-GCM ciphertext of PKCS#8 bytes]
 * The IV is always the first 12 bytes — no separate field needed.
 */
export async function buildKeyPairBundle(password: string): Promise<KeyPairBundle> {
  const keyPair = await generateKeyPair()
  const salt = generateSalt()
  const wrappingKey = await deriveWrappingKey(password, salt)

  const pkcs8Buffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encryptedPkcs8 = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    pkcs8Buffer,
  )

  // Pack IV + ciphertext into a single blob so the server stores one field.
  const wrapped = new Uint8Array(12 + encryptedPkcs8.byteLength)
  wrapped.set(iv, 0)
  wrapped.set(new Uint8Array(encryptedPkcs8), 12)

  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey)

  return {
    publicKeyBase64: bufferToBase64(publicKeyBuffer),
    wrappedPrivateKeyBase64: bufferToBase64(wrapped),
    pbkdf2SaltBase64: bufferToBase64(salt),
  }
}

/**
 * Called on login. Re-derives the AES-GCM wrapping key and decrypts the
 * PKCS#8 private key bytes back into a non-extractable CryptoKey in memory.
 * Throws if the password is wrong (AES-GCM authentication tag fails).
 */
export async function restoreCryptoSession(
  profile: UserProfile,
  password: string,
): Promise<CryptoSession> {
  const salt = base64ToBuffer(profile.pbkdf2_salt)
  const wrappingKey = await deriveWrappingKey(password, salt)

  const wrapped = base64ToBuffer(profile.wrapped_private_key)
  const iv = wrapped.slice(0, 12)
  const encryptedPkcs8 = wrapped.slice(12)

  const pkcs8Buffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    encryptedPkcs8,
  )

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['unwrapKey'],
  )

  const publicKey = await importPublicKey(profile.public_key)

  return { privateKey, publicKey, userId: profile.id }
}
