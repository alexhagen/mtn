import { describe, it, expect } from 'vitest'
import { encryptApiKey, decryptApiKey, getSessionKey } from '../encryption'

describe('Encryption Service', () => {
  describe('encryptApiKey and decryptApiKey', () => {
    it('should encrypt and decrypt an API key successfully', async () => {
      const apiKey = 'sk-ant-test-api-key-12345'
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted = await encryptApiKey(apiKey, sessionKey)
      expect(encrypted).not.toBe(apiKey)
      expect(encrypted.length).toBeGreaterThan(0)
      
      const decrypted = await decryptApiKey(encrypted, sessionKey)
      expect(decrypted).toBe(apiKey)
    })

    it('should produce different ciphertext for the same plaintext (due to random IV)', async () => {
      const apiKey = 'sk-ant-test-api-key-12345'
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted1 = await encryptApiKey(apiKey, sessionKey)
      const encrypted2 = await encryptApiKey(apiKey, sessionKey)
      
      expect(encrypted1).not.toBe(encrypted2)
      
      // But both should decrypt to the same value
      expect(await decryptApiKey(encrypted1, sessionKey)).toBe(apiKey)
      expect(await decryptApiKey(encrypted2, sessionKey)).toBe(apiKey)
    })

    it('should fail to decrypt with wrong session key', async () => {
      const apiKey = 'sk-ant-test-api-key-12345'
      const sessionKey1 = getSessionKey('user-1')
      const sessionKey2 = getSessionKey('user-2')
      
      const encrypted = await encryptApiKey(apiKey, sessionKey1)
      
      await expect(decryptApiKey(encrypted, sessionKey2)).rejects.toThrow()
    })

    it('should handle empty strings', async () => {
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted = await encryptApiKey('', sessionKey)
      const decrypted = await decryptApiKey(encrypted, sessionKey)
      
      expect(decrypted).toBe('')
    })

    it('should handle special characters in API key', async () => {
      const apiKey = 'sk-ant-!@#$%^&*()_+-=[]{}|;:,.<>?'
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted = await encryptApiKey(apiKey, sessionKey)
      const decrypted = await decryptApiKey(encrypted, sessionKey)
      
      expect(decrypted).toBe(apiKey)
    })
  })

  describe('getSessionKey', () => {
    it('should generate consistent session keys for the same user ID', () => {
      const userId = 'test-user-123'
      
      const key1 = getSessionKey(userId)
      const key2 = getSessionKey(userId)
      
      expect(key1).toBe(key2)
    })

    it('should generate different session keys for different user IDs', () => {
      const key1 = getSessionKey('user-1')
      const key2 = getSessionKey('user-2')
      
      expect(key1).not.toBe(key2)
    })

    it('should return the user ID as the session key', () => {
      const userId = 'test-user'
      const key = getSessionKey(userId)
      
      expect(key).toBe(userId)
    })
  })
})
