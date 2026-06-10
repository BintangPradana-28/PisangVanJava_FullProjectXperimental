import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { describe, it, expect } from 'vitest'

describe('Compliance: AES-256-GCM Backup Encryption Integrity', () => {
  it('should perfectly encrypt and decrypt financial payloads without data loss', () => {
    const secretKey = randomBytes(32)
    const iv = randomBytes(16)
    const payload = Buffer.from(
      'INSERT INTO payments (id, amount) VALUES (1, 500000);'
    )

    // 1. Encrypt
    const cipher = createCipheriv('aes-256-gcm', secretKey, iv)
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
    const authTag = cipher.getAuthTag()

    // 2. Decrypt
    const decipher = createDecipheriv('aes-256-gcm', secretKey, iv, { authTagLength: 16 })
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])

    // 3. Assert
    expect(decrypted.toString()).toBe(payload.toString())
  })

  it('should throw an exception if the ciphertext is tampered with (Auth Tag verification)', () => {
    const secretKey = randomBytes(32)
    const iv = randomBytes(16)
    const payload = Buffer.from('SENSITIVE PII DATA')

    const cipher = createCipheriv('aes-256-gcm', secretKey, iv)
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Tamper with the encrypted data
    encrypted[0] = encrypted[0] ^ 1

    const decipher = createDecipheriv('aes-256-gcm', secretKey, iv, { authTagLength: 16 })
    decipher.setAuthTag(authTag)

    expect(() => {
      Buffer.concat([decipher.update(encrypted), decipher.final()])
    }).toThrow() // V8 Crypto will throw an 'Unsupported state or unable to authenticate data' error
  })
})
