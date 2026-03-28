import { describe, it, expect } from 'vitest'
import { encryptApiKey, decryptApiKey, getSessionKey } from '../encryption'

describe('Encryption Service', () => {
  describe('encryptApiKey and decryptApiKey', () => {
    it('should encrypt and decrypt an API key successfully', () => {
      const apiKey = 'sk-ant-test-api-key-12345'
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted = encryptApiKey(apiKey, sessionKey)
      expect(encrypted).not.toBe(apiKey)
      expect(encrypted.length).toBeGreaterThan(0)
      
      const decrypted = decryptApiKey(encrypted, sessionKey)
      expect(decrypted).toBe(apiKey)
    })

    it('should produce different ciphertext for the same plaintext (due to random IV)', () => {
      const apiKey = 'sk-ant-test-api-key-12345'
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted1 = encryptApiKey(apiKey, sessionKey)
      const encrypted2 = encryptApiKey(apiKey, sessionKey)
      
      expect(encrypted1).not.toBe(encrypted2)
      
      // But both should decrypt to the same value
      expect(decryptApiKey(encrypted1, sessionKey)).toBe(apiKey)
      expect(decryptApiKey(encrypted2, sessionKey)).toBe(apiKey)
    })

    it('should fail to decrypt with wrong session key', () => {
      const apiKey = 'sk-ant-test-api-key-12345'
      const sessionKey1 = getSessionKey('user-1')
      const sessionKey2 = getSessionKey('user-2')
      
      const encrypted = encryptApiKey(apiKey, sessionKey1)
      
      expect(() => {
        decryptApiKey(encrypted, sessionKey2)
      }).toThrow()
    })

    it('should handle empty strings', () => {
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted = encryptApiKey('', sessionKey)
      expect(encrypted).toBe('')
      
      const decrypted = decryptApiKey('', sessionKey)
      expect(decrypted).toBe('')
    })

    it('should handle special characters in API key', () => {
      const apiKey = 'sk-ant-!@#$%^&*()_+-=[]{}|;:,.<>?'
      const sessionKey = getSessionKey('test-user-id')
      
      const encrypted = encryptApiKey(apiKey, sessionKey)
      const decrypted = decryptApiKey(encrypted, sessionKey)
      
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

    it('should generate a 32-character base64 key', () => {
      const key = getSessionKey('test-user')
      
      expect(key.length).toBe(32)
      expect(key).toMatch(/^[A-Za-z0-9+/=]+$/)
    })
  })
})
