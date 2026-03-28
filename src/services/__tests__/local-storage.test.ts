import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalStorageBackend } from '../storage/local'
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types'

// Mock idb
vi.mock('idb', () => {
  const mockDB = {
    get: vi.fn(),
    put: vi.fn(),
    getAll: vi.fn(),
    getAllFromIndex: vi.fn(),
    delete: vi.fn(),
  }

  return {
    openDB: vi.fn().mockResolvedValue(mockDB),
  }
})

describe('LocalStorageBackend', () => {
  let storage: LocalStorageBackend
  let mockDB: any

  beforeEach(async () => {
    vi.clearAllMocks()
    storage = new LocalStorageBackend()
    
    // Get reference to the mock DB
    const { openDB } = await import('idb')
    mockDB = await openDB('mtn-db', 1)
  })

  describe('Settings operations', () => {
    it('should save and retrieve settings', async () => {
      const settings: Settings = {
        anthropicApiKey: 'test-key',
        corsProxyUrl: 'https://proxy.example.com',
        topics: [
          { id: '1', name: 'Tech', rssFeeds: ['https://example.com/feed'] },
        ],
      }

      mockDB.get.mockResolvedValue(settings)

      await storage.saveSettings(settings)
      expect(mockDB.put).toHaveBeenCalledWith('settings', settings, 'current')

      const retrieved = await storage.getSettings()
      expect(retrieved).toEqual(settings)
    })

    it('should return null when no settings exist', async () => {
      mockDB.get.mockResolvedValue(undefined)

      const settings = await storage.getSettings()
      expect(settings).toBeNull()
    })
  })

  describe('Article operations', () => {
    it('should save an article', async () => {
      const article: Article = {
        id: 'article-1',
        title: 'Test Article',
        url: 'https://example.com/article',
        content: 'Article content',
        wordCount: 100,
        savedAt: Date.now(),
        monthKey: '2026-03',
      }

      await storage.saveArticle(article)
      expect(mockDB.put).toHaveBeenCalledWith('articles', article)
    })

    it('should get articles by month', async () => {
      const articles: Article[] = [
        {
          id: 'article-1',
          title: 'Article 1',
          url: 'https://example.com/1',
          content: 'Content 1',
          wordCount: 100,
          savedAt: Date.now(),
          monthKey: '2026-03',
        },
        {
          id: 'article-2',
          title: 'Article 2',
          url: 'https://example.com/2',
          content: 'Content 2',
          wordCount: 200,
          savedAt: Date.now(),
          monthKey: '2026-03',
        },
      ]

      mockDB.getAllFromIndex.mockResolvedValue(articles)

      const retrieved = await storage.getArticlesByMonth('2026-03')
      expect(retrieved).toEqual(articles)
      expect(mockDB.getAllFromIndex).toHaveBeenCalledWith('articles', 'by-month', '2026-03')
    })

    it('should delete an article', async () => {
      await storage.deleteArticle('article-1')
      expect(mockDB.delete).toHaveBeenCalledWith('articles', 'article-1')
    })

    it('should get all articles', async () => {
      const articles: Article[] = [
        {
          id: 'article-1',
          title: 'Article 1',
          url: 'https://example.com/1',
          content: 'Content 1',
          wordCount: 100,
          savedAt: Date.now(),
          monthKey: '2026-03',
        },
      ]

      mockDB.getAll.mockResolvedValue(articles)

      const retrieved = await storage.getAllArticles()
      expect(retrieved).toEqual(articles)
      expect(mockDB.getAll).toHaveBeenCalledWith('articles')
    })
  })

  describe('Summary operations', () => {
    it('should save a summary', async () => {
      const summary: DailySummary = {
        id: 'summary-1',
        topicId: 'topic-1',
        topicName: 'Technology',
        summary: '# Daily Summary\n\nContent here',
        generatedAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
      }

      await storage.saveSummary(summary)
      expect(mockDB.put).toHaveBeenCalledWith('summaries', summary)
    })

    it('should get summary by topic (most recent non-expired)', async () => {
      const now = Date.now()
      const summaries: DailySummary[] = [
        {
          id: 'summary-1',
          topicId: 'topic-1',
          topicName: 'Tech',
          summary: 'Old summary',
          generatedAt: now - 2 * 24 * 60 * 60 * 1000,
          expiresAt: now + 5 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'summary-2',
          topicId: 'topic-1',
          topicName: 'Tech',
          summary: 'New summary',
          generatedAt: now - 1 * 24 * 60 * 60 * 1000,
          expiresAt: now + 6 * 24 * 60 * 60 * 1000,
        },
      ]

      mockDB.getAllFromIndex.mockResolvedValue(summaries)

      const retrieved = await storage.getSummaryByTopic('topic-1')
      expect(retrieved).toEqual(summaries[1]) // Most recent
    })

    it('should filter out expired summaries', async () => {
      const now = Date.now()
      const summaries: DailySummary[] = [
        {
          id: 'summary-1',
          topicId: 'topic-1',
          topicName: 'Tech',
          summary: 'Expired summary',
          generatedAt: now - 10 * 24 * 60 * 60 * 1000,
          expiresAt: now - 1 * 24 * 60 * 60 * 1000, // Expired yesterday
        },
      ]

      mockDB.getAllFromIndex.mockResolvedValue(summaries)

      const retrieved = await storage.getSummaryByTopic('topic-1')
      expect(retrieved).toBeNull()
    })

    it('should cleanup expired summaries', async () => {
      const now = Date.now()
      const summaries: DailySummary[] = [
        {
          id: 'summary-1',
          topicId: 'topic-1',
          topicName: 'Tech',
          summary: 'Expired',
          generatedAt: now - 10 * 24 * 60 * 60 * 1000,
          expiresAt: now - 1 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'summary-2',
          topicId: 'topic-2',
          topicName: 'Science',
          summary: 'Valid',
          generatedAt: now,
          expiresAt: now + 7 * 24 * 60 * 60 * 1000,
        },
      ]

      mockDB.getAll.mockResolvedValue(summaries)

      await storage.cleanupExpiredSummaries()
      
      expect(mockDB.delete).toHaveBeenCalledWith('summaries', 'summary-1')
      expect(mockDB.delete).not.toHaveBeenCalledWith('summaries', 'summary-2')
    })
  })

  describe('Book list operations', () => {
    it('should save a book list', async () => {
      const bookList: QuarterlyBookList = {
        id: '2026-Q1',
        quarter: '2026-Q1',
        books: [
          {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
            description: 'Test description',
            purchaseLinks: { amazon: 'https://amazon.com/book' },
            isRead: false,
          },
        ],
        generatedAt: Date.now(),
      }

      await storage.saveBookList(bookList)
      expect(mockDB.put).toHaveBeenCalledWith('bookLists', bookList)
    })

    it('should get book list by quarter', async () => {
      const bookList: QuarterlyBookList = {
        id: '2026-Q1',
        quarter: '2026-Q1',
        books: [],
        generatedAt: Date.now(),
      }

      mockDB.get.mockResolvedValue(bookList)

      const retrieved = await storage.getBookListByQuarter('2026-Q1')
      expect(retrieved).toEqual(bookList)
      expect(mockDB.get).toHaveBeenCalledWith('bookLists', '2026-Q1')
    })

    it('should return null when book list does not exist', async () => {
      mockDB.get.mockResolvedValue(undefined)

      const retrieved = await storage.getBookListByQuarter('2026-Q2')
      expect(retrieved).toBeNull()
    })
  })
})
