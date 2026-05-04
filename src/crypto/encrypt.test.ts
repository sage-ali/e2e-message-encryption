import { describe, it, expect } from 'vitest'
import { generateKeyPair } from './keys.ts'
import { encryptMessage, decryptMessage } from './encrypt.ts'

describe('encryptMessage', () => {
  it('produces a payload with four non-empty base64 fields', async () => {
    const kp = await generateKeyPair()
    const payload = await encryptMessage('hello world', kp.publicKey, kp.publicKey)
    expect(payload.ciphertext.length).toBeGreaterThan(0)
    expect(payload.iv.length).toBeGreaterThan(0)
    expect(payload.encryptedKey.length).toBeGreaterThan(0)
    expect(payload.encryptedKeyForSelf.length).toBeGreaterThan(0)
  })

  it('never embeds plaintext in the output', async () => {
    const kp = await generateKeyPair()
    const plaintext = 'super secret message'
    const payload = await encryptMessage(plaintext, kp.publicKey, kp.publicKey)
    const raw = JSON.stringify(payload)
    expect(raw).not.toContain(plaintext)
  })

  it('uses a fresh IV each time — same plaintext produces different ciphertext', async () => {
    const kp = await generateKeyPair()
    const p1 = await encryptMessage('same text', kp.publicKey, kp.publicKey)
    const p2 = await encryptMessage('same text', kp.publicKey, kp.publicKey)
    expect(p1.ciphertext).not.toBe(p2.ciphertext)
    expect(p1.iv).not.toBe(p2.iv)
  })
})

describe('decryptMessage', () => {
  it('recipient can decrypt a message encrypted for them', async () => {
    const sender = await generateKeyPair()
    const recipient = await generateKeyPair()
    const plaintext = 'Hello, recipient!'

    const payload = await encryptMessage(plaintext, recipient.publicKey, sender.publicKey)
    const result = await decryptMessage(payload, recipient.privateKey)
    expect(result).toBe(plaintext)
  })

  it('sender can decrypt their own sent message via encryptedKeyForSelf', async () => {
    const sender = await generateKeyPair()
    const recipient = await generateKeyPair()
    const plaintext = 'Message I sent'

    const payload = await encryptMessage(plaintext, recipient.publicKey, sender.publicKey)
    // Swap encryptedKey with encryptedKeyForSelf to simulate sender reading their outbox
    const payloadForSelf = { ...payload, encryptedKey: payload.encryptedKeyForSelf }
    const result = await decryptMessage(payloadForSelf, sender.privateKey)
    expect(result).toBe(plaintext)
  })

  it('throws when a wrong private key is used', async () => {
    const sender = await generateKeyPair()
    const recipient = await generateKeyPair()
    const attacker = await generateKeyPair()

    const payload = await encryptMessage('secret', recipient.publicKey, sender.publicKey)
    await expect(decryptMessage(payload, attacker.privateKey)).rejects.toThrow()
  })

  it('round-trips unicode and emoji content', async () => {
    const kp = await generateKeyPair()
    const plaintext = 'Héllo wörld 🔐💬'
    const payload = await encryptMessage(plaintext, kp.publicKey, kp.publicKey)
    const result = await decryptMessage(payload, kp.privateKey)
    expect(result).toBe(plaintext)
  })
})
