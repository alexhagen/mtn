import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types'

// Mock the storage backends
vi.mock('../storage/local', () => ({
  LocalStorageBackend: vi.fn().mockImplementation(() => ({
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    saveArticle: vi.fn(),
    getArticlesByMonth: vi.fn(),
    deleteArticle: vi.fn(),
    getAllArticles: vi.fn(),
    saveSummary: vi.fn(),
    getSummaryByTopic: vi.fn(),
    getAllSummaries: vi.fn(),
    deleteSummary: vi.fn(),
    cleanupExpiredSummaries: vi.fn(),
    logTopicActivity: vi.fn(),
    getActiveTopicIdsForQuarter: vi.fn(),
    saveBookList: vi.fn(),
    getBookListByQuarterAndTopic: vi.fn(),
    getBookListsByQuarter: vi.fn(),
  })),
}))

vi.mock('../storage/supabase', () => ({
  SupabaseStorageBackend: vi.fn().mockImplementation(() => ({
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
    saveArticle: vi.fn(),
    getArticlesByMonth: vi.fn(),
    deleteArticle: vi.fn(),
    getAllArticles: vi.fn(),
    saveSummary: vi.fn(),
    getSummaryByTopic: vi.fn(),
    getAllSummaries: vi.fn(),
    deleteSummary: vi.fn(),
    cleanupExpiredSummaries: vi.fn(),
    logTopicActivity: vi.fn(),
    getActiveTopicIdsForQuarter: vi.fn(),
    saveBookList: vi.fn(),
    getBookListByQuarterAndTopic: vi.fn(),
    getBookListsByQuarter: vi.fn(),
  })),
}))

vi.mock('../supabase', () => ({
  getSupabaseClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
  isSupabaseConfigured: vi.fn(() => false),
}))

describe('Storage Index - Backend Factory', () => {
  const originalEnv = { ...import.meta.env }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset modules to clear singleton
    vi.resetModules()
  })

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv)
  })

  describe('Backend selection', () => {
    it('should use LocalStorageBackend when storage mode is local', async () => {
      import.meta.env.VITE_STORAGE_MODE = 'local'
      
      const { loadSettings } = await import('../storage/index')
      const { LocalStorageBackend } = await import('../storage/local')

      await loadSettings()

      expect(LocalStorageBackend).toHaveBeenCalled()
    })

    it('should use LocalStorageBackend when Supabase is not configured', async () => {
      import.meta.env.VITE_STORAGE_MODE = 'cloud'
      const { isSupabaseConfigured } = await import('../supabase')
      ;(isSupabaseConfigured as any).mockReturnValue(false)

      const { loadSettings } = await import('../storage/index')
      const { LocalStorageBackend } = await import('../storage/local')

      await loadSettings()

      expect(LocalStorageBackend).toHaveBeenCalled()
    })

    it('should use SupabaseStorageBackend when mode is cloud and Supabase is configured', async () => {
      import.meta.env.VITE_STORAGE_MODE = 'cloud'
      const { isSupabaseConfigured } = await import('../supabase')
      ;(isSupabaseConfigured as any).mockReturnValue(true)

      const { loadSettings } = await import('../storage/index')
      const { SupabaseStorageBackend } = await import('../storage/supabase')

      await loadSettings()

      expect(SupabaseStorageBackend).toHaveBeenCalled()
    })

    it('should default to local mode when VITE_STORAGE_MODE is not set', async () => {
      delete import.meta.env.VITE_STORAGE_MODE

      const { loadSettings } = await import('../storage/index')
      const { LocalStorageBackend } = await import('../storage/local')

      await loadSettings()

      expect(LocalStorageBackend).toHaveBeenCalled()
    })
  })

  describe('Facade functions', () => {
    beforeEach(async () => {
      import.meta.env.VITE_STORAGE_MODE = 'local'
      vi.resetModules()
    })

    it('should call backend.getSettings via loadSettings', async () => {
      const mockSettings: Settings = {
        anthropicApiKey: 'test-key',
        corsProxyUrl: 'https://proxy.com',
        topics: [],
      }

      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn().mockResolvedValue(mockSettings),
        saveSettings: vi.fn(),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { loadSettings } = await import('../storage/index')
      const result = await loadSettings()

      expect(mockBackend.getSettings).toHaveBeenCalled()
      expect(result).toEqual(mockSettings)
    })

    it('should call backend.saveSettings via saveSettings', async () => {
      const mockSettings: Settings = {
        anthropicApiKey: 'test-key',
        corsProxyUrl: 'https://proxy.com',
        topics: [],
      }

      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn().mockResolvedValue(undefined),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { saveSettings } = await import('../storage/index')
      await saveSettings(mockSettings)

      expect(mockBackend.saveSettings).toHaveBeenCalledWith(mockSettings)
    })

    it('should call backend.saveArticle via saveArticle', async () => {
      const mockArticle: Article = {
        id: 'test-id',
        title: 'Test Article',
        url: 'https://example.com',
        content: 'Test content',
        wordCount: 100,
        savedAt: new Date().toISOString(),
      }

      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        saveArticle: vi.fn().mockResolvedValue(undefined),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { saveArticle } = await import('../storage/index')
      await saveArticle(mockArticle)

      expect(mockBackend.saveArticle).toHaveBeenCalledWith(mockArticle)
    })

    it('should call backend.getArticlesByMonth via getArticlesByMonth', async () => {
      const mockArticles: Article[] = []

      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn().mockResolvedValue(mockArticles),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { getArticlesByMonth } = await import('../storage/index')
      const result = await getArticlesByMonth('2024-03')

      expect(mockBackend.getArticlesByMonth).toHaveBeenCalledWith('2024-03')
      expect(result).toEqual(mockArticles)
    })

    it('should call backend.deleteArticle via deleteArticle', async () => {
      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn().mockResolvedValue(undefined),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { deleteArticle } = await import('../storage/index')
      await deleteArticle('test-id')

      expect(mockBackend.deleteArticle).toHaveBeenCalledWith('test-id')
    })

    it('should call backend.saveSummary via saveSummary', async () => {
      const mockSummary: DailySummary = {
        id: 'summary-id',
        topicId: 'topic-id',
        content: 'Summary content',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }

      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn().mockResolvedValue(undefined),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { saveSummary } = await import('../storage/index')
      await saveSummary(mockSummary)

      expect(mockBackend.saveSummary).toHaveBeenCalledWith(mockSummary)
    })

    it('should call backend.getSummaryByTopic via getSummaryByTopic', async () => {
      const mockSummary: DailySummary = {
        id: 'summary-id',
        topicId: 'topic-id',
        content: 'Summary content',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      }

      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn().mockResolvedValue(mockSummary),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { getSummaryByTopic } = await import('../storage/index')
      const result = await getSummaryByTopic('topic-id')

      expect(mockBackend.getSummaryByTopic).toHaveBeenCalledWith('topic-id')
      expect(result).toEqual(mockSummary)
    })

    it('should call backend.saveBookList via saveQuarterBooks', async () => {
      const mockBookList: QuarterlyBookList = {
        id: 'book-list-id',
        quarter: '2024-Q1',
        topicId: 'topic-id',
        books: [],
        generatedAt: new Date().toISOString(),
      }

      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn(),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn().mockResolvedValue(undefined),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { saveQuarterBooks } = await import('../storage/index')
      await saveQuarterBooks(mockBookList)

      expect(mockBackend.saveBookList).toHaveBeenCalledWith(mockBookList)
    })

    it('should call backend.logTopicActivity via logTopicActivity', async () => {
      const { LocalStorageBackend } = await import('../storage/local')
      const mockBackend = {
        getSettings: vi.fn(),
        saveSettings: vi.fn(),
        saveArticle: vi.fn(),
        getArticlesByMonth: vi.fn(),
        deleteArticle: vi.fn(),
        getAllArticles: vi.fn(),
        saveSummary: vi.fn(),
        getSummaryByTopic: vi.fn(),
        getAllSummaries: vi.fn(),
        deleteSummary: vi.fn(),
        cleanupExpiredSummaries: vi.fn(),
        logTopicActivity: vi.fn().mockResolvedValue(undefined),
        getActiveTopicIdsForQuarter: vi.fn(),
        saveBookList: vi.fn(),
        getBookListByQuarterAndTopic: vi.fn(),
        getBookListsByQuarter: vi.fn(),
      }
      ;(LocalStorageBackend as any).mockImplementation(() => mockBackend)

      const { logTopicActivity } = await import('../storage/index')
      await logTopicActivity('topic-id')

      expect(mockBackend.logTopicActivity).toHaveBeenCalledWith('topic-id')
    })
  })
})
