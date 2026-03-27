import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageDomain } from '../storage/domain';
import type { StorageBackend } from '../storage/types';
import type { DailySummary, Article, QuarterlyBookList, Settings } from '../../types';

// Mock backend for testing domain logic in isolation
class MockStorageBackend implements StorageBackend {
  // Storage state
  summaries: DailySummary[] = [];
  articles: Article[] = [];
  bookLists: QuarterlyBookList[] = [];
  settings: Settings | null = null;
  topicActivity: Map<string, Set<string>> = new Map();

  // Track method calls
  cleanupCalled = false;

  async getSettings(): Promise<Settings | null> {
    return this.settings;
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.settings = settings;
  }

  async saveArticle(article: Article): Promise<void> {
    this.articles.push(article);
  }

  async getArticlesByMonth(monthKey: string): Promise<Article[]> {
    return this.articles.filter(a => a.monthKey === monthKey);
  }

  async deleteArticle(id: string): Promise<void> {
    this.articles = this.articles.filter(a => a.id !== id);
  }

  async getAllArticles(): Promise<Article[]> {
    return this.articles;
  }

  async saveSummary(summary: DailySummary): Promise<void> {
    this.summaries.push(summary);
  }

  async getSummaryByTopic(topicId: string): Promise<DailySummary | null> {
    const now = Date.now();
    const validSummaries = this.summaries.filter(
      s => s.topicId === topicId && s.expiresAt > now
    );
    
    if (validSummaries.length === 0) return null;
    
    return validSummaries.sort((a, b) => b.generatedAt - a.generatedAt)[0];
  }

  async getAllSummaries(): Promise<DailySummary[]> {
    return this.summaries;
  }

  async deleteSummary(id: string): Promise<void> {
    this.summaries = this.summaries.filter(s => s.id !== id);
  }

  async cleanupExpiredSummaries(): Promise<void> {
    this.cleanupCalled = true;
    const now = Date.now();
    this.summaries = this.summaries.filter(s => s.expiresAt > now);
  }

  async logTopicActivity(topicId: string, topicName: string): Promise<void> {
    if (!this.topicActivity.has(topicId)) {
      this.topicActivity.set(topicId, new Set());
    }
    const today = new Date().toISOString().split('T')[0];
    this.topicActivity.get(topicId)!.add(today);
  }

  async getActiveTopicIdsForQuarter(quarter: string): Promise<string[]> {
    return Array.from(this.topicActivity.keys());
  }

  async saveBookList(bookList: QuarterlyBookList): Promise<void> {
    // Remove existing book list for same quarter + topic
    this.bookLists = this.bookLists.filter(
      b => !(b.quarter === bookList.quarter && b.topicId === bookList.topicId)
    );
    this.bookLists.push(bookList);
  }

  async getBookListByQuarterAndTopic(quarter: string, topicId: string): Promise<QuarterlyBookList | null> {
    return this.bookLists.find(b => b.quarter === quarter && b.topicId === topicId) || null;
  }

  async getBookListsByQuarter(quarter: string): Promise<QuarterlyBookList[]> {
    return this.bookLists.filter(b => b.quarter === quarter);
  }
}

describe('StorageDomain', () => {
  let backend: MockStorageBackend;
  let domain: StorageDomain;

  beforeEach(() => {
    backend = new MockStorageBackend();
    domain = new StorageDomain(backend);
  });

  describe('Summary operations', () => {
    it('getTodaysSummary returns null when no cached summary exists', async () => {
      const summary = await domain.getTodaysSummary('topic-1');
      expect(summary).toBeNull();
    });

    it('getTodaysSummary returns valid cached summary', async () => {
      const now = Date.now();
      const validSummary: DailySummary = {
        id: 'summary-1',
        topicId: 'topic-1',
        topicName: 'Technology',
        summary: '# Daily Summary\n\nContent here',
        generatedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours from now
      };

      await backend.saveSummary(validSummary);

      const result = await domain.getTodaysSummary('topic-1');
      expect(result).toEqual(validSummary);
    });

    it('getTodaysSummary returns null when cached summary is expired', async () => {
      const now = Date.now();
      const expiredSummary: DailySummary = {
        id: 'summary-1',
        topicId: 'topic-1',
        topicName: 'Technology',
        summary: '# Daily Summary\n\nContent here',
        generatedAt: now - 48 * 60 * 60 * 1000, // 48 hours ago
        expiresAt: now - 24 * 60 * 60 * 1000, // Expired 24 hours ago
      };

      await backend.saveSummary(expiredSummary);

      const result = await domain.getTodaysSummary('topic-1');
      expect(result).toBeNull();
    });

    it('saveSummaryWithCleanup saves summary and triggers cleanup', async () => {
      const now = Date.now();
      
      // Add an expired summary
      const expiredSummary: DailySummary = {
        id: 'summary-old',
        topicId: 'topic-1',
        topicName: 'Technology',
        summary: 'Old summary',
        generatedAt: now - 48 * 60 * 60 * 1000,
        expiresAt: now - 24 * 60 * 60 * 1000,
      };
      await backend.saveSummary(expiredSummary);

      // Save new summary with cleanup
      const newSummary: DailySummary = {
        id: 'summary-new',
        topicId: 'topic-1',
        topicName: 'Technology',
        summary: 'New summary',
        generatedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      };

      backend.cleanupCalled = false;
      await domain.saveSummaryWithCleanup(newSummary);

      // Verify cleanup was called
      expect(backend.cleanupCalled).toBe(true);

      // Verify expired summary was removed
      const allSummaries = await backend.getAllSummaries();
      expect(allSummaries).toHaveLength(1);
      expect(allSummaries[0].id).toBe('summary-new');
    });
  });

  describe('Article operations', () => {
    it('getCurrentMonthArticles returns articles for current month', async () => {
      const now = new Date();
      const monthKey = domain.getMonthKey(now);

      const article1: Article = {
        id: 'article-1',
        title: 'Article 1',
        url: 'https://example.com/1',
        content: 'Content 1',
        wordCount: 100,
        savedAt: Date.now(),
        monthKey,
        topicId: 'topic-1',
      };

      const article2: Article = {
        id: 'article-2',
        title: 'Article 2',
        url: 'https://example.com/2',
        content: 'Content 2',
        wordCount: 200,
        savedAt: Date.now(),
        monthKey,
        topicId: 'topic-2',
      };

      await backend.saveArticle(article1);
      await backend.saveArticle(article2);

      const articles = await domain.getCurrentMonthArticles();
      expect(articles).toHaveLength(2);
      expect(articles).toContainEqual(article1);
      expect(articles).toContainEqual(article2);
    });

    it('getCurrentMonthArticles filters by topic when topicId provided', async () => {
      const now = new Date();
      const monthKey = domain.getMonthKey(now);

      const article1: Article = {
        id: 'article-1',
        title: 'Article 1',
        url: 'https://example.com/1',
        content: 'Content 1',
        wordCount: 100,
        savedAt: Date.now(),
        monthKey,
        topicId: 'topic-1',
      };

      const article2: Article = {
        id: 'article-2',
        title: 'Article 2',
        url: 'https://example.com/2',
        content: 'Content 2',
        wordCount: 200,
        savedAt: Date.now(),
        monthKey,
        topicId: 'topic-2',
      };

      await backend.saveArticle(article1);
      await backend.saveArticle(article2);

      const articles = await domain.getCurrentMonthArticles('topic-1');
      expect(articles).toHaveLength(1);
      expect(articles[0]).toEqual(article1);
    });

    it('getCurrentMonthArticles returns empty array when no articles exist', async () => {
      const articles = await domain.getCurrentMonthArticles();
      expect(articles).toEqual([]);
    });
  });

  describe('Settings operations', () => {
    it('getSettings returns null when no settings exist', async () => {
      const settings = await domain.getSettings();
      expect(settings).toBeNull();
    });

    it('saveSettings and getSettings work correctly', async () => {
      const settings: Settings = {
        anthropicApiKey: 'test-key',
        corsProxyUrl: 'https://proxy.example.com',
        topics: [
          { id: '1', name: 'Tech', rssFeeds: ['https://example.com/feed'] },
        ],
      };

      await domain.saveSettings(settings);
      const retrieved = await domain.getSettings();
      expect(retrieved).toEqual(settings);
    });
  });

  describe('Book operations', () => {
    it('getCurrentQuarterBooks returns null when no book list exists', async () => {
      const books = await domain.getCurrentQuarterBooks('topic-1');
      expect(books).toBeNull();
    });

    it('getCurrentQuarterBooks returns book list for current quarter and topic', async () => {
      const quarter = await domain.getCurrentQuarter();
      const bookList: QuarterlyBookList = {
        id: `${quarter}-topic-1`,
        quarter,
        topicId: 'topic-1',
        topicName: 'Technology',
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
      };

      await backend.saveBookList(bookList);

      const result = await domain.getCurrentQuarterBooks('topic-1');
      expect(result).toEqual(bookList);
    });

    it('saveQuarterBooks saves book list correctly', async () => {
      const quarter = await domain.getCurrentQuarter();
      const bookList: QuarterlyBookList = {
        id: `${quarter}-topic-1`,
        quarter,
        topicId: 'topic-1',
        topicName: 'Technology',
        books: [],
        generatedAt: Date.now(),
      };

      await domain.saveQuarterBooks(bookList);

      const result = await backend.getBookListByQuarterAndTopic(quarter, 'topic-1');
      expect(result).toEqual(bookList);
    });
  });

  describe('Utility functions', () => {
    it('generateId generates unique UUIDs', () => {
      const id1 = domain.generateId();
      const id2 = domain.generateId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('getMonthKey generates correct month key', () => {
      const date = new Date('2026-03-15');
      const monthKey = domain.getMonthKey(date);
      expect(monthKey).toBe('2026-03');
    });

    it('getMonthKey pads single digit months', () => {
      const date = new Date('2026-01-15');
      const monthKey = domain.getMonthKey(date);
      expect(monthKey).toBe('2026-01');
    });

    it('getCurrentQuarter generates correct quarter string', async () => {
      const quarter = await domain.getCurrentQuarter();
      expect(quarter).toMatch(/^\d{4}-Q[1-4]$/);
    });
  });

  describe('Backend exposure', () => {
    it('exposes backend for advanced operations', () => {
      expect(domain.backend).toBe(backend);
    });

    it('allows direct backend access for operations not in domain layer', async () => {
      const now = Date.now();
      const summary: DailySummary = {
        id: 'summary-1',
        topicId: 'topic-1',
        topicName: 'Technology',
        summary: 'Test',
        generatedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      };

      await domain.backend.saveSummary(summary);
      const allSummaries = await domain.backend.getAllSummaries();
      expect(allSummaries).toHaveLength(1);
    });
  });
});
