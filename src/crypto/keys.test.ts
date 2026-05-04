import { describe, it, expect } from 'vitest'
import type { UserProfile } from '../types/index.ts'
import {
  generateKeyPair,
  generateSalt,
  buildKeyPairBundle,
  importPublicKey,
  restoreCryptoSession,
} from './keys.ts'
import { bufferToBase64 } from './utils.ts'

describe('generateKeyPair', () => {
  it('returns an RSA-OAEP keypair', async () => {
    const kp = await generateKeyPair()
    expect(kp.publicKey.type).toBe('public')
    expect(kp.privateKey.type).toBe('private')
    expect(kp.publicKey.algorithm.name).toBe('RSA-OAEP')
    expect(kp.privateKey.algorithm.name).toBe('RSA-OAEP')
  })
})

describe('generateSalt', () => {
  it('returns a 16-byte Uint8Array', () => {
    const salt = generateSalt()
    expect(salt).toBeInstanceOf(Uint8Array)
    expect(salt.byteLength).toBe(16)
  })

  it('generates a different salt each call', () => {
    const a = generateSalt()
    const b = generateSalt()
    expect(bufferToBase64(a)).not.toBe(bufferToBase64(b))
  })
})

describe('buildKeyPairBundle', () => {
  it('returns non-empty base64 strings for all three fields', async () => {
    const bundle = await buildKeyPairBundle('test-password-42!')
    expect(bundle.publicKeyBase64.length).toBeGreaterThan(0)
    expect(bundle.wrappedPrivateKeyBase64.length).toBeGreaterThan(0)
    expect(bundle.pbkdf2SaltBase64.length).toBeGreaterThan(0)
  })

  it('produces different bundles for different passwords', async () => {
    const a = await buildKeyPairBundle('password-one')
    const b = await buildKeyPairBundle('password-two')
    expect(a.wrappedPrivateKeyBase64).not.toBe(b.wrappedPrivateKeyBase64)
  })
})

describe('importPublicKey', () => {
  it('round-trips a public key through base64', async () => {
    const kp = await generateKeyPair()
    const exported = await crypto.subtle.exportKey('spki', kp.publicKey)
    const b64 = bufferToBase64(exported)
    const imported = await importPublicKey(b64)
    expect(imported.type).toBe('public')
    expect(imported.algorithm.name).toBe('RSA-OAEP')
  })
})

describe('restoreCryptoSession', () => {
  it('unwraps the private key with the correct password', async () => {
    const password = 'correct-horse-battery!'
    const bundle = await buildKeyPairBundle(password)

    const fakeProfile: UserProfile = {
      id: 'user-abc',
      username: 'alice',
      display_name: 'Alice',
      public_key: bundle.publicKeyBase64,
      wrapped_private_key: bundle.wrappedPrivateKeyBase64,
      pbkdf2_salt: bundle.pbkdf2SaltBase64,
      created_at: '2026-01-01T00:00:00Z',
    }

    const session = await restoreCryptoSession(fakeProfile, password)
    expect(session.privateKey.type).toBe('private')
    expect(session.publicKey.type).toBe('public')
    expect(session.userId).toBe('user-abc')
    expect(session.privateKey.extractable).toBe(false)
  })

  it('throws when the password is wrong', async () => {
    const bundle = await buildKeyPairBundle('right-password')

    const fakeProfile: UserProfile = {
      id: 'user-xyz',
      username: 'bob',
      display_name: 'Bob',
      public_key: bundle.publicKeyBase64,
      wrapped_private_key: bundle.wrappedPrivateKeyBase64,
      pbkdf2_salt: bundle.pbkdf2SaltBase64,
      created_at: '2026-01-01T00:00:00Z',
    }

    await expect(restoreCryptoSession(fakeProfile, 'wrong-password')).rejects.toThrow()
  })
})
