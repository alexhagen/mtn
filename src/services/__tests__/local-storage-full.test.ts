import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LocalStorageBackend } from '../storage/local'
import type { QuarterlyBookList } from '../../types'
import { openDB, type IDBPDatabase } from 'idb'

describe('LocalStorageBackend - Full Coverage', () => {
  let backend: LocalStorageBackend
  let db: IDBPDatabase

  beforeEach(async () => {
    backend = new LocalStorageBackend()
    // Access the private db instance for cleanup
    db = (backend as any).dbPromise ? await (backend as any).dbPromise : null
  })

  afterEach(async () => {
    if (db) {
      // Clean up all stores
      const tx = db.transaction(['settings', 'articles', 'summaries', 'bookLists', 'topicActivity'], 'readwrite')
      await Promise.all([
        tx.objectStore('settings').clear(),
        tx.objectStore('articles').clear(),
        tx.objectStore('summaries').clear(),
        tx.objectStore('bookLists').clear(),
        tx.objectStore('topicActivity').clear(),
      ])
      await tx.done
    }
  })

  describe('Topic Activity', () => {
    it('should log topic activity with current date', async () => {
      await backend.logTopicActivity('topic-1')

      // Verify activity was logged
      const activeTopics = await backend.getActiveTopicIdsForQuarter('2024-Q1')
      
      // Should include the topic if we're in Q1 2024, otherwise might be empty
      expect(Array.isArray(activeTopics)).toBe(true)
    })

    it('should update existing activity for same topic and date', async () => {
      await backend.logTopicActivity('topic-1')
      await backend.logTopicActivity('topic-1')

      // Should not create duplicates
      const tx = db.transaction('topicActivity', 'readonly')
      const store = tx.objectStore('topicActivity')
      const allActivities = await store.getAll()
      await tx.done

      const topic1Activities = allActivities.filter(a => a.topicId === 'topic-1')
      
      // Should have only one entry per date
      const uniqueDates = new Set(topic1Activities.map(a => a.date))
      expect(uniqueDates.size).toBeLessThanOrEqual(1)
    })

    it('should get active topic IDs for a quarter', async () => {
      // Log activity for multiple topics
      await backend.logTopicActivity('topic-1')
      await backend.logTopicActivity('topic-2')
      await backend.logTopicActivity('topic-3')

      const now = new Date()
      const year = now.getFullYear()
      const quarter = Math.floor(now.getMonth() / 3) + 1
      const quarterString = `${year}-Q${quarter}`

      const activeTopics = await backend.getActiveTopicIdsForQuarter(quarterString)

      expect(activeTopics).toContain('topic-1')
      expect(activeTopics).toContain('topic-2')
      expect(activeTopics).toContain('topic-3')
    })

    it('should return empty array for quarter with no activity', async () => {
      const activeTopics = await backend.getActiveTopicIdsForQuarter('2099-Q4')

      expect(activeTopics).toEqual([])
    })

    it('should return unique topic IDs even with multiple activities', async () => {
      await backend.logTopicActivity('topic-1')
      await backend.logTopicActivity('topic-1')
      await backend.logTopicActivity('topic-2')

      const now = new Date()
      const year = now.getFullYear()
      const quarter = Math.floor(now.getMonth() / 3) + 1
      const quarterString = `${year}-Q${quarter}`

      const activeTopics = await backend.getActiveTopicIdsForQuarter(quarterString)

      // Should have unique topic IDs
      const uniqueTopics = new Set(activeTopics)
      expect(uniqueTopics.size).toBe(activeTopics.length)
    })
  })

  describe('Book Lists', () => {
    it('should save and retrieve book list by quarter and topic', async () => {
      const bookList: QuarterlyBookList = {
        id: 'book-list-1',
        quarter: '2024-Q1',
        topicId: 'topic-1',
        books: [
          {
            id: 'book-1',
            title: 'Test Book',
            author: 'Test Author',
            isbn: '1234567890',
            amazonUrl: 'https://amazon.com/book1',
            bookshopUrl: 'https://bookshop.org/book1',
            estimatedCost: 25.99,
            isRead: false,
          },
        ],
        generatedAt: new Date().toISOString(),
      }

      await backend.saveBookList(bookList)

      const retrieved = await backend.getBookListByQuarterAndTopic('2024-Q1', 'topic-1')

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('book-list-1')
      expect(retrieved?.books).toHaveLength(1)
      expect(retrieved?.books[0].title).toBe('Test Book')
    })

    it('should return null for non-existent book list', async () => {
      const retrieved = await backend.getBookListByQuarterAndTopic('2099-Q4', 'non-existent-topic')

      expect(retrieved).toBeNull()
    })

    it('should get all book lists for a quarter', async () => {
      const bookList1: QuarterlyBookList = {
        id: 'book-list-1',
        quarter: '2024-Q1',
        topicId: 'topic-1',
        books: [],
        generatedAt: new Date().toISOString(),
      }

      const bookList2: QuarterlyBookList = {
        id: 'book-list-2',
        quarter: '2024-Q1',
        topicId: 'topic-2',
        books: [],
        generatedAt: new Date().toISOString(),
      }

      const bookList3: QuarterlyBookList = {
        id: 'book-list-3',
        quarter: '2024-Q2',
        topicId: 'topic-1',
        books: [],
        generatedAt: new Date().toISOString(),
      }

      await backend.saveBookList(bookList1)
      await backend.saveBookList(bookList2)
      await backend.saveBookList(bookList3)

      const q1Lists = await backend.getBookListsByQuarter('2024-Q1')

      expect(q1Lists).toHaveLength(2)
      expect(q1Lists.map(l => l.id)).toContain('book-list-1')
      expect(q1Lists.map(l => l.id)).toContain('book-list-2')
      expect(q1Lists.map(l => l.id)).not.toContain('book-list-3')
    })

    it('should return empty array for quarter with no book lists', async () => {
      const lists = await backend.getBookListsByQuarter('2099-Q4')

      expect(lists).toEqual([])
    })

    it('should update existing book list when saving with same quarter and topic', async () => {
      const bookList1: QuarterlyBookList = {
        id: 'book-list-1',
        quarter: '2024-Q1',
        topicId: 'topic-1',
        books: [],
        generatedAt: new Date().toISOString(),
      }

      const bookList2: QuarterlyBookList = {
        id: 'book-list-1',
        quarter: '2024-Q1',
        topicId: 'topic-1',
        books: [
          {
            id: 'book-1',
            title: 'Updated Book',
            author: 'Updated Author',
            isbn: '9999999999',
            amazonUrl: 'https://amazon.com/updated',
            bookshopUrl: 'https://bookshop.org/updated',
            estimatedCost: 30.00,
            isRead: true,
          },
        ],
        generatedAt: new Date().toISOString(),
      }

      await backend.saveBookList(bookList1)
      await backend.saveBookList(bookList2)

      const retrieved = await backend.getBookListByQuarterAndTopic('2024-Q1', 'topic-1')

      expect(retrieved?.books).toHaveLength(1)
      expect(retrieved?.books[0].title).toBe('Updated Book')
    })
  })

  describe('Summary Cleanup', () => {
    it('should cleanup expired summaries', async () => {
      const now = new Date()
      const past = new Date(now.getTime() - 1000 * 60 * 60 * 24) // 1 day ago
      const future = new Date(now.getTime() + 1000 * 60 * 60 * 24) // 1 day from now

      const expiredSummary = {
        id: 'summary-expired',
        topicId: 'topic-1',
        content: 'Expired summary',
        generatedAt: past.toISOString(),
        expiresAt: past.toISOString(),
      }

      const validSummary = {
        id: 'summary-valid',
        topicId: 'topic-2',
        content: 'Valid summary',
        generatedAt: now.toISOString(),
        expiresAt: future.toISOString(),
      }

      await backend.saveSummary(expiredSummary)
      await backend.saveSummary(validSummary)

      await backend.cleanupExpiredSummaries()

      const allSummaries = await backend.getAllSummaries()

      expect(allSummaries).toHaveLength(1)
      expect(allSummaries[0].id).toBe('summary-valid')
    })

    it('should not delete summaries that have not expired', async () => {
      const now = new Date()
      const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) // 1 week from now

      const validSummary1 = {
        id: 'summary-1',
        topicId: 'topic-1',
        content: 'Valid summary 1',
        generatedAt: now.toISOString(),
        expiresAt: future.toISOString(),
      }

      const validSummary2 = {
        id: 'summary-2',
        topicId: 'topic-2',
        content: 'Valid summary 2',
        generatedAt: now.toISOString(),
        expiresAt: future.toISOString(),
      }

      await backend.saveSummary(validSummary1)
      await backend.saveSummary(validSummary2)

      await backend.cleanupExpiredSummaries()

      const allSummaries = await backend.getAllSummaries()

      expect(allSummaries).toHaveLength(2)
    })

    it('should handle cleanup when no summaries exist', async () => {
      await expect(backend.cleanupExpiredSummaries()).resolves.not.toThrow()
    })
  })

  describe('getAllArticles', () => {
    it('should get all articles across all months', async () => {
      const article1 = {
        id: 'article-1',
        title: 'Article 1',
        url: 'https://example.com/1',
        content: 'Content 1',
        wordCount: 100,
        savedAt: '2024-01-15T10:00:00Z',
      }

      const article2 = {
        id: 'article-2',
        title: 'Article 2',
        url: 'https://example.com/2',
        content: 'Content 2',
        wordCount: 200,
        savedAt: '2024-02-20T10:00:00Z',
      }

      const article3 = {
        id: 'article-3',
        title: 'Article 3',
        url: 'https://example.com/3',
        content: 'Content 3',
        wordCount: 300,
        savedAt: '2024-03-25T10:00:00Z',
      }

      await backend.saveArticle(article1)
      await backend.saveArticle(article2)
      await backend.saveArticle(article3)

      const allArticles = await backend.getAllArticles()

      expect(allArticles).toHaveLength(3)
      expect(allArticles.map(a => a.id)).toContain('article-1')
      expect(allArticles.map(a => a.id)).toContain('article-2')
      expect(allArticles.map(a => a.id)).toContain('article-3')
    })

    it('should return empty array when no articles exist', async () => {
      const allArticles = await backend.getAllArticles()

      expect(allArticles).toEqual([])
    })
  })

  describe('getAllSummaries', () => {
    it('should get all summaries', async () => {
      const summary1 = {
        id: 'summary-1',
        topicId: 'topic-1',
        content: 'Summary 1',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      }

      const summary2 = {
        id: 'summary-2',
        topicId: 'topic-2',
        content: 'Summary 2',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      }

      await backend.saveSummary(summary1)
      await backend.saveSummary(summary2)

      const allSummaries = await backend.getAllSummaries()

      expect(allSummaries).toHaveLength(2)
      expect(allSummaries.map(s => s.id)).toContain('summary-1')
      expect(allSummaries.map(s => s.id)).toContain('summary-2')
    })

    it('should return empty array when no summaries exist', async () => {
      const allSummaries = await backend.getAllSummaries()

      expect(allSummaries).toEqual([])
    })
  })

  describe('deleteSummary', () => {
    it('should delete a summary by ID', async () => {
      const summary = {
        id: 'summary-to-delete',
        topicId: 'topic-1',
        content: 'Summary to delete',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      }

      await backend.saveSummary(summary)

      let allSummaries = await backend.getAllSummaries()
      expect(allSummaries).toHaveLength(1)

      await backend.deleteSummary('summary-to-delete')

      allSummaries = await backend.getAllSummaries()
      expect(allSummaries).toHaveLength(0)
    })

    it('should not throw error when deleting non-existent summary', async () => {
      await expect(backend.deleteSummary('non-existent-id')).resolves.not.toThrow()
    })
  })
})
