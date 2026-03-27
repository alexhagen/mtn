import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabaseStorageBackend } from '../storage/supabase'
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types'

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
      const mockSelect = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          anthropic_api_key_encrypted: 'encrypted-key',
          cors_proxy_url: 'https://proxy.com',
          daily_summary_system_prompt: 'system prompt',
          daily_summary_user_prompt: 'user prompt',
          book_rec_system_prompt: null,
          book_rec_user_prompt: null,
        },
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      })

      const mockTopicsFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'topic-1',
                name: 'Topic 1',
                rss_feeds: ['https://feed1.com'],
                position: 0,
              },
            ],
            error: null,
          }),
        }),
      })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect.mockReturnValue({
            single: mockSingle,
          }),
        })
        .mockReturnValueOnce(mockTopicsFrom())

      const result = await backend.getSettings()

      expect(result).toBeDefined()
      expect(result?.anthropicApiKey).toBe('encrypted-key')
      expect(result?.corsProxyUrl).toBe('https://proxy.com')
      expect(result?.topics).toHaveLength(1)
      expect(result?.topics[0].name).toBe('Topic 1')
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { LocalStorageBackend } = await import('../storage/local')
      const mockLocalBackend = new LocalStorageBackend()
      ;(mockLocalBackend.getSettings as any).mockResolvedValue({
        anthropicApiKey: 'local-key',
        corsProxyUrl: 'https://local-proxy.com',
        topics: [],
      })

      const result = await backend.getSettings()

      expect(LocalStorageBackend).toHaveBeenCalled()
    })

    it('should fallback to local storage on Supabase error', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })

      const result = await backend.getSettings()

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
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

      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockDelete = vi.fn().mockResolvedValue({ data: null, error: null })

      mockSupabaseClient.from
        .mockReturnValueOnce({
          upsert: mockUpsert,
        })
        .mockReturnValueOnce({
          delete: vi.fn().mockReturnValue({
            eq: mockDelete,
          }),
        })
        .mockReturnValueOnce({
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        })

      await backend.saveSettings(mockSettings)

      expect(mockUpsert).toHaveBeenCalled()
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const mockSettings: Settings = {
        anthropicApiKey: 'test-key',
        corsProxyUrl: 'https://proxy.com',
        topics: [],
      }

      await backend.saveSettings(mockSettings)

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
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
        savedAt: new Date().toISOString(),
      }

      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert,
      })

      await backend.saveArticle(mockArticle)

      expect(mockUpsert).toHaveBeenCalled()
    })

    it('should fallback to local storage when not authenticated', async () => {
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
        savedAt: new Date().toISOString(),
      }

      await backend.saveArticle(mockArticle)

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('getArticlesByMonth', () => {
    it('should fetch articles from Supabase when authenticated', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockResolvedValue({
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

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            eq: mockEq2.mockReturnValue({
              order: mockOrder,
            }),
          }),
        }),
      })

      const result = await backend.getArticlesByMonth('2024-03')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Test Article')
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      await backend.getArticlesByMonth('2024-03')

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('deleteArticle', () => {
    it('should delete article from Supabase when authenticated', async () => {
      const mockDelete = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockResolvedValue({ data: null, error: null })

      mockSupabaseClient.from.mockReturnValue({
        delete: mockDelete.mockReturnValue({
          eq: mockEq.mockReturnValue({
            eq: mockEq2,
          }),
        }),
      })

      await backend.deleteArticle('article-1')

      expect(mockDelete).toHaveBeenCalled()
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
        content: 'Summary content',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }

      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert,
      })

      await backend.saveSummary(mockSummary)

      expect(mockUpsert).toHaveBeenCalled()
    })

    it('should fallback to local storage when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const mockSummary: DailySummary = {
        id: 'summary-1',
        topicId: 'topic-1',
        content: 'Summary content',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }

      await backend.saveSummary(mockSummary)

      const { LocalStorageBackend } = await import('../storage/local')
      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('getSummaryByTopic', () => {
    it('should fetch summary from Supabase when authenticated', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockEq2 = vi.fn().mockReturnThis()
      const mockGt = vi.fn().mockReturnThis()
      const mockOrder = vi.fn().mockReturnThis()
      const mockLimit = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
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

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            eq: mockEq2.mockReturnValue({
              gt: mockGt.mockReturnValue({
                order: mockOrder.mockReturnValue({
                  limit: mockLimit.mockReturnValue({
                    single: mockSingle,
                  }),
                }),
              }),
            }),
          }),
        }),
      })

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

      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert,
      })

      await backend.saveBookList(mockBookList)

      expect(mockUpsert).toHaveBeenCalled()
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

  describe('logTopicActivity', () => {
    it('should log topic activity to Supabase when authenticated', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert,
      })

      await backend.logTopicActivity('topic-1', 'Topic 1')

      expect(mockUpsert).toHaveBeenCalled()
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
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockGte = vi.fn().mockReturnThis()
      const mockLte = vi.fn().mockResolvedValue({
        data: [
          { topic_id: 'topic-1' },
          { topic_id: 'topic-2' },
        ],
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            gte: mockGte.mockReturnValue({
              lte: mockLte,
            }),
          }),
        }),
      })

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
