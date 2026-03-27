import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSupabaseClient, isSupabaseConfigured } from '../supabase'

describe('Supabase Client Service', () => {
  const originalEnv = { ...import.meta.env }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original env
    Object.assign(import.meta.env, originalEnv)
  })

  describe('isSupabaseConfigured', () => {
    it('should return true when both URL and anon key are set', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

      expect(isSupabaseConfigured()).toBe(true)
    })

    it('should return false when URL is missing', () => {
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

      expect(isSupabaseConfigured()).toBe(false)
    })

    it('should return false when anon key is missing', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = ''

      expect(isSupabaseConfigured()).toBe(false)
    })

    it('should return false when both are missing', () => {
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_ANON_KEY = ''

      expect(isSupabaseConfigured()).toBe(false)
    })

    it('should return false when URL is undefined', () => {
      delete import.meta.env.VITE_SUPABASE_URL
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

      expect(isSupabaseConfigured()).toBe(false)
    })

    it('should return false when anon key is undefined', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      delete import.meta.env.VITE_SUPABASE_ANON_KEY

      expect(isSupabaseConfigured()).toBe(false)
    })
  })

  describe('getSupabaseClient', () => {
    it('should return a Supabase client when configured', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

      const client = getSupabaseClient()

      expect(client).toBeDefined()
      expect(client.auth).toBeDefined()
      expect(client.from).toBeDefined()
    })

    it('should return the same singleton instance on multiple calls', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

      const client1 = getSupabaseClient()
      const client2 = getSupabaseClient()

      expect(client1).toBe(client2)
    })

    it('should throw error when URL is missing', () => {
      import.meta.env.VITE_SUPABASE_URL = ''
      import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'

      expect(() => getSupabaseClient()).toThrow('Supabase URL and anon key must be configured')
    })

    it('should throw error when anon key is missing', () => {
      import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
      import.meta.env.VITE_SUPABASE_ANON_KEY = ''

      expect(() => getSupabaseClient()).toThrow('Supabase URL and anon key must be configured')
    })
  })
})
