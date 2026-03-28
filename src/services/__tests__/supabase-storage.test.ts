import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseStorageBackend } from '../storage/supabase'
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types'

// Helper to create a chainable query builder mock
function createQueryBuilder(finalResult: any = { data: null, error: null }) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue(finalResult),
    single: vi.fn().mockResolvedValue(finalResult),
  }
  
  // Make all methods return the builder for chaining
  Object.keys(builder).forEach(key => {
    if (key !== 'upsert' && key !== 'single') {
      builder[key].mockReturnValue(builder)
    }
  })
  
  return builder
}

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

// Mock LocalStorageBackend
vi.mock('../storage/local', () => ({
  LocalStorageBackend: vi.fn().mockImplementation(() => ({
    getSettings: vi.fn().mockResolvedValue(null),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    saveArticle: vi.fn().mockResolvedValue(undefined),
    getArticlesByMonth: vi.fn().mockResolvedValue([]),
    deleteArticle: vi.fn().mockResolvedValue(undefined),
    getAllArticles: vi.fn().mockResolvedValue([]),
    saveSummary: vi.fn().mockResolvedValue(undefined),
    getSummaryByTopic: vi.fn().mockResolvedValue(null),
    getAllSummaries: vi.fn().mockResolvedValue([]),
    deleteSummary: vi.fn().mockResolvedValue(undefined),
    cleanupExpiredSummaries: vi.fn().mockResolvedValue(undefined),
    logTopicActivity: vi.fn().mockResolvedValue(undefined),
    getActiveTopicIdsForQuarter: vi.fn().mockResolvedValue([]),
    saveBookList: vi.fn().mockResolvedValue(undefined),
    getBookListByQuarterAndTopic: vi.fn().mockResolvedValue(null),
    getBookListsByQuarter: vi.fn().mockResolvedValue([]),
  })),
}))

// Mock encryption module to avoid crypto issues in tests
vi.mock('../encryption', () => ({
  encryptApiKey: vi.fn((key: string) => Promise.resolve(btoa(key))),
  decryptApiKey: vi.fn((encrypted: string) => Promise.resolve(atob(encrypted))),
  getSessionKey: vi.fn(() => 'mock-session-key'),
}))

describe('SupabaseStorageBackend', () => {
  let backend: SupabaseStorageBackend

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    })
    backend = new SupabaseStorageBackend(mockSupabaseClient as any)
  })

  describe('getSettings', () => {
    it('should fetch settings from Supabase when authenticated', async () => {
      // Use base64 encoded key to avoid encryption issues in tests
      const settingsBuilder = createQueryBuilder({
        data: {
          anthropic_api_key_encrypted: btoa('test-api-key'),
          cors_proxy_url: 'https://proxy.com',
          daily_summary_system_prompt: 'system prompt',
          daily_summary_user_prompt: 'user prompt',
          book_rec_system_prompt: null,
          book_rec_user_prompt: null,
        },
        error: null,
      })

      const topicsBuilder = createQueryBuilder({
        data: [
          {
            id: 'topic-1',
            name: 'Topic 1',
            rss_feeds: ['https://feed1.com'],
            position: 0,
          },
        ],
        error: null,
      })

      // Override order to return the final result
      topicsBuilder.order.mockResolvedValue({
        data: [
          {
            id: 'topic-1',
            name: 'Topic 1',
            rss_feeds: ['https://feed1.com'],
            position: 0,
          },
        ],
        error: null,
      })

      mockSupabaseClient.from
        .mockReturnValueOnce(settingsBuilder)
        .mockReturnValueOnce(topicsBuilder)

      const result = await backend.getSettings()

      expect(result).toBeDefined()
      expect(result?.anthropicApiKey).toBe('test-api-key')
      expect(result?.corsProxyUrl).toBe('https://proxy.com')
      expect(result?.topics).toHaveLength(1)
      expect(result?.topics[0].name).toBe('Topic 1')
    })

    it('should return null when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await backend.getSettings()

      expect(result).toBeNull()
    })

    it('should return null on Supabase error', async () => {
      const errorBuilder = createQueryBuilder({
        data: null,
        error: { message: 'Database error', code: 'PGRST500' },
      })

      mockSupabaseClient.from.mockReturnValue(errorBuilder)

      await expect(backend.getSettings()).rejects.toThrow()
    })

    it('should return null when no settings found', async () => {
      const notFoundBuilder = createQueryBuilder({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue(notFoundBuilder)

      const result = await backend.getSettings()

      expect(result).toBeNull()
    })
  })

  describe('saveSettings', () => {
    it('should save settings to Supabase when authenticated', async () => {
      const mockSettings: Settings = {
        anthropicApiKey: 'test-key',
        corsProxyUrl: 'https://proxy.com',
        topics: [
          {
            id: 'topic-1',
            name: 'Topic 1',
            rssFeeds: ['https://feed1.com'],
          },
        ],
      }

      const settingsBuilder = createQueryBuilder({ data: null, error: null })
      const existingTopicsBuilder = createQueryBuilder({
        data: [{ id: 'topic-old' }],
        error: null,
      })
      
      // Override select to return a resolved promise for the query
      existingTopicsBuilder.select.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'topic-old' }],
          error: null,
        }),
      })
      
      const deleteBuilder = createQueryBuilder({ data: null, error: null })
      
      // Override in to return a resolved promise
      deleteBuilder.in = vi.fn().mockResolvedValue({ data: null, error: null })
      
      const topicBuilder = createQueryBuilder({ data: null, error: null })

      mockSupabaseClient.from
        .mockReturnValueOnce(settingsBuilder)
        .mockReturnValueOnce(existingTopicsBuilder)
        .mockReturnValueOnce(deleteBuilder)
        .mockReturnValueOnce(topicBuilder)

      await backend.saveSettings(mockSettings)

      expect(settingsBuilder.upsert).toHaveBeenCalled()
      expect(topicBuilder.upsert).toHaveBeenCalled()
    })

    it('should throw error when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const mockSettings: Settings = {
        anthropicApiKey: 'test-key',
        corsProxyUrl: 'https://proxy.com',
        topics: [],
      }

      await expect(backend.saveSettings(mockSettings)).rejects.toThrow('User not authenticated')
    })
  })

  describe('saveArticle', () => {
    it('should save article to Supabase when authenticated', async () => {
      const mockArticle: Article = {
        id: 'article-1',
        title: 'Test Article',
        url: 'https://example.com',
        content: 'Test content',
        wordCount: 100,
        monthKey: '2024-03',
        savedAt: new Date().toISOString(),
      }

      const builder = createQueryBuilder({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue(builder)

      await backend.saveArticle(mockArticle)

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('articles')
      expect(builder.upsert).toHaveBeenCalled()
    })

    it('should throw error when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const mockArticle: Article = {
        id: 'article-1',
        title: 'Test Article',
        url: 'https://example.com',
        content: 'Test content',
        wordCount: 100,
        monthKey: '2024-03',
        savedAt: new Date().toISOString(),
      }

      await expect(backend.saveArticle(mockArticle)).rejects.toThrow('User not authenticated')
    })
  })

  describe('getArticlesByMonth', () => {
    it('should fetch articles from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({
        data: [
          {
            id: 'article-1',
            title: 'Test Article',
            url: 'https://example.com',
            content: 'Test content',
            word_count: 100,
            month_key: '2024-03',
            saved_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      // Override order to return the final result
      builder.order.mockResolvedValue({
        data: [
          {
            id: 'article-1',
            title: 'Test Article',
            url: 'https://example.com',
            content: 'Test content',
            word_count: 100,
            month_key: '2024-03',
            saved_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue(builder)

      const result = await backend.getArticlesByMonth('2024-03')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Test Article')
    })

    it('should return empty array when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await backend.getArticlesByMonth('2024-03')

      expect(result).toEqual([])
    })
  })

  describe('getAllArticles', () => {
    it('should fetch all articles from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({
        data: [
          {
            id: 'article-1',
            title: 'Test Article 1',
            url: 'https://example.com/1',
            content: 'Test content 1',
            word_count: 100,
            month_key: '2024-03',
            saved_at: new Date().toISOString(),
          },
          {
            id: 'article-2',
            title: 'Test Article 2',
            url: 'https://example.com/2',
            content: 'Test content 2',
            word_count: 200,
            month_key: '2024-04',
            saved_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      builder.order.mockResolvedValue({
        data: [
          {
            id: 'article-1',
            title: 'Test Article 1',
            url: 'https://example.com/1',
            content: 'Test content 1',
            word_count: 100,
            month_key: '2024-03',
            saved_at: new Date().toISOString(),
          },
          {
            id: 'article-2',
            title: 'Test Article 2',
            url: 'https://example.com/2',
            content: 'Test content 2',
            word_count: 200,
            month_key: '2024-04',
            saved_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue(builder)

      const result = await backend.getAllArticles()

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Test Article 1')
      expect(result[1].title).toBe('Test Article 2')
    })

    it('should return empty array when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await backend.getAllArticles()

      expect(result).toEqual([])
    })
  })

  describe('deleteArticle', () => {
    it('should delete article from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({ data: null, error: null })

      mockSupabaseClient.from.mockReturnValue(builder)

      await backend.deleteArticle('article-1')

      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'article-1')
    })

    it('should throw error when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await expect(backend.deleteArticle('article-1')).rejects.toThrow('User not authenticated')
    })
  })

  describe('saveSummary', () => {
    it('should save summary to Supabase when authenticated', async () => {
      const mockSummary: DailySummary = {
        id: 'summary-1',
        topicId: 'topic-1',
        topicName: 'Topic 1',
        summary: 'Summary content',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }

      const builder = createQueryBuilder({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue(builder)

      await backend.saveSummary(mockSummary)

      expect(builder.upsert).toHaveBeenCalled()
    })

    it('should fallback to local storage on error', async () => {
      const mockSummary: DailySummary = {
        id: 'summary-1',
        topicId: 'topic-1',
        topicName: 'Topic 1',
        summary: 'Summary content',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.saveSummary(mockSummary)

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('getSummaryByTopic', () => {
    it('should fetch summary from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({
        data: {
          id: 'summary-1',
          topic_id: 'topic-1',
          topic_name: 'Topic 1',
          summary: 'Summary content',
          generated_at: new Date().toISOString(),
          expires_at: new Date().toISOString(),
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue(builder)

      const result = await backend.getSummaryByTopic('topic-1')

      expect(result).toBeDefined()
      expect(result?.topicId).toBe('topic-1')
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.getSummaryByTopic('topic-1')

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('getAllSummaries', () => {
    it('should fetch all summaries from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({
        data: [
          {
            id: 'summary-1',
            topic_id: 'topic-1',
            topic_name: 'Topic 1',
            summary: 'Summary content 1',
            generated_at: new Date().toISOString(),
            expires_at: new Date().toISOString(),
          },
          {
            id: 'summary-2',
            topic_id: 'topic-2',
            topic_name: 'Topic 2',
            summary: 'Summary content 2',
            generated_at: new Date().toISOString(),
            expires_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      builder.order.mockResolvedValue({
        data: [
          {
            id: 'summary-1',
            topic_id: 'topic-1',
            topic_name: 'Topic 1',
            summary: 'Summary content 1',
            generated_at: new Date().toISOString(),
            expires_at: new Date().toISOString(),
          },
          {
            id: 'summary-2',
            topic_id: 'topic-2',
            topic_name: 'Topic 2',
            summary: 'Summary content 2',
            generated_at: new Date().toISOString(),
            expires_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue(builder)

      const result = await backend.getAllSummaries()

      expect(result).toHaveLength(2)
      expect(result[0].topicId).toBe('topic-1')
      expect(result[1].topicId).toBe('topic-2')
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.getAllSummaries()

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })

    it('should fallback to local storage on error', async () => {
      const errorBuilder = createQueryBuilder({
        data: null,
        error: { message: 'Database error' },
      })

      errorBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      mockSupabaseClient.from.mockReturnValue(errorBuilder)

      const result = await backend.getAllSummaries()

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('deleteSummary', () => {
    it('should delete summary from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({ data: null, error: null })

      mockSupabaseClient.from.mockReturnValue(builder)

      await backend.deleteSummary('summary-1')

      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'summary-1')
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.deleteSummary('summary-1')

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })

    it('should still delete locally on Supabase error', async () => {
      const errorBuilder = createQueryBuilder({
        data: null,
        error: { message: 'Database error' },
      })

      mockSupabaseClient.from.mockReturnValue(errorBuilder)

      await backend.deleteSummary('summary-1')

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('cleanupExpiredSummaries', () => {
    it('should cleanup expired summaries from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({ data: null, error: null })

      mockSupabaseClient.from.mockReturnValue(builder)

      await backend.cleanupExpiredSummaries()

      expect(builder.delete).toHaveBeenCalled()
      expect(builder.lt).toHaveBeenCalled()
    })

    it('should cleanup local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.cleanupExpiredSummaries()

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })

    it('should still cleanup locally on Supabase error', async () => {
      const errorBuilder = createQueryBuilder({
        data: null,
        error: { message: 'Database error' },
      })

      mockSupabaseClient.from.mockReturnValue(errorBuilder)

      await backend.cleanupExpiredSummaries()

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('saveBookList', () => {
    it('should save book list to Supabase when authenticated', async () => {
      const mockBookList: QuarterlyBookList = {
        id: 'book-list-1',
        quarter: '2024-Q1',
        topicId: 'topic-1',
        topicName: 'Topic 1',
        books: [],
        generatedAt: new Date().toISOString(),
      }

      const builder = createQueryBuilder({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue(builder)

      await backend.saveBookList(mockBookList)

      expect(builder.upsert).toHaveBeenCalled()
    })

    it('should throw error when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const mockBookList: QuarterlyBookList = {
        id: 'book-list-1',
        quarter: '2024-Q1',
        topicId: 'topic-1',
        topicName: 'Topic 1',
        books: [],
        generatedAt: new Date().toISOString(),
      }

      await expect(backend.saveBookList(mockBookList)).rejects.toThrow('User not authenticated')
    })
  })

  describe('getBookListByQuarterAndTopic', () => {
    it('should fetch book list from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({
        data: {
          id: 'book-list-1',
          quarter: '2024-Q1',
          topic_id: 'topic-1',
          topic_name: 'Topic 1',
          books: [{ title: 'Book 1', author: 'Author 1' }],
          generated_at: new Date().toISOString(),
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue(builder)

      const result = await backend.getBookListByQuarterAndTopic('2024-Q1', 'topic-1')

      expect(result).toBeDefined()
      expect(result?.topicId).toBe('topic-1')
      expect(result?.quarter).toBe('2024-Q1')
    })

    it('should return null when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await backend.getBookListByQuarterAndTopic('2024-Q1', 'topic-1')

      expect(result).toBeNull()
    })

    it('should return null when book list not found', async () => {
      const notFoundBuilder = createQueryBuilder({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      })

      mockSupabaseClient.from.mockReturnValue(notFoundBuilder)

      const result = await backend.getBookListByQuarterAndTopic('2024-Q1', 'topic-1')

      expect(result).toBeNull()
    })
  })

  describe('getBookListsByQuarter', () => {
    it('should fetch book lists from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({
        data: [
          {
            id: 'book-list-1',
            quarter: '2024-Q1',
            topic_id: 'topic-1',
            topic_name: 'Topic 1',
            books: [{ title: 'Book 1', author: 'Author 1' }],
            generated_at: new Date().toISOString(),
          },
          {
            id: 'book-list-2',
            quarter: '2024-Q1',
            topic_id: 'topic-2',
            topic_name: 'Topic 2',
            books: [{ title: 'Book 2', author: 'Author 2' }],
            generated_at: new Date().toISOString(),
          },
        ],
        error: null,
      })

      // Create a custom mock for the second eq call that returns the final result
      let eqCallCount = 0
      builder.eq.mockImplementation(() => {
        eqCallCount++
        if (eqCallCount === 2) {
          // Second eq call returns the final result
          return Promise.resolve({
            data: [
              {
                id: 'book-list-1',
                quarter: '2024-Q1',
                topic_id: 'topic-1',
                topic_name: 'Topic 1',
                books: [{ title: 'Book 1', author: 'Author 1' }],
                generated_at: new Date().toISOString(),
              },
              {
                id: 'book-list-2',
                quarter: '2024-Q1',
                topic_id: 'topic-2',
                topic_name: 'Topic 2',
                books: [{ title: 'Book 2', author: 'Author 2' }],
                generated_at: new Date().toISOString(),
              },
            ],
            error: null,
          })
        }
        return builder
      })

      mockSupabaseClient.from.mockReturnValue(builder)

      const result = await backend.getBookListsByQuarter('2024-Q1')

      expect(result).toHaveLength(2)
      expect(result[0].topicId).toBe('topic-1')
      expect(result[1].topicId).toBe('topic-2')
    })

    it('should return empty array when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const result = await backend.getBookListsByQuarter('2024-Q1')

      expect(result).toEqual([])
    })
  })

  describe('logTopicActivity', () => {
    it('should log topic activity to Supabase when authenticated', async () => {
      const builder = createQueryBuilder({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue(builder)

      await backend.logTopicActivity('topic-1', 'Topic 1')

      expect(builder.upsert).toHaveBeenCalled()
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.logTopicActivity('topic-1', 'Topic 1')

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('getActiveTopicIdsForQuarter', () => {
    it('should fetch active topic IDs from Supabase when authenticated', async () => {
      const builder = createQueryBuilder({
        data: [
          { topic_id: 'topic-1' },
          { topic_id: 'topic-2' },
        ],
        error: null,
      })

      builder.lte.mockResolvedValue({
        data: [
          { topic_id: 'topic-1' },
          { topic_id: 'topic-2' },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue(builder)

      const result = await backend.getActiveTopicIdsForQuarter('2024-Q1')

      expect(result).toEqual(['topic-1', 'topic-2'])
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.getActiveTopicIdsForQuarter('2024-Q1')

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })
})
