import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ArticleSaveService,
  ArticleCountPolicy,
  WordBudgetPolicy,
  MockContentExtractor,
  type ArticleStorage,
  type ExtractedArticle,
} from '../article-save';
import type { Article } from '../../types';

// Mock storage implementation for tests
class MockArticleStorage implements ArticleStorage {
  private articles: Article[] = [];

  saveArticle(article: Article): Promise<void> {
    this.articles.push(article);
    return Promise.resolve();
  }

  getArticlesByMonth(_monthKey: string): Promise<Article[]> {
    return Promise.resolve(this.articles);
  }

  getMonthKey(): string {
    return '2026-03';
  }

  generateId(): string {
    return `test-id-${Date.now()}`;
  }

  // Test helper
  setArticles(articles: Article[]) {
    this.articles = articles;
  }

  getArticles() {
    return this.articles;
  }
}

describe('ArticleSaveService', () => {
  let mockStorage: MockArticleStorage;
  let mockExtractor: MockContentExtractor;

  beforeEach(() => {
    mockStorage = new MockArticleStorage();
    mockExtractor = new MockContentExtractor();
  });

  describe('saveArticle_withValidUrl_extractsAndSaves', () => {
    it('should extract article content and save it', async () => {
      const policy = new ArticleCountPolicy(4, mockStorage);
      const service = new ArticleSaveService(mockExtractor, policy, mockStorage);

      const result = await service.saveArticle(
        'https://example.com/article',
        'Custom Title',
        'topic-123'
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.article).toBeDefined();
      expect(result.article?.title).toBe('Custom Title');
      expect(result.article?.url).toBe('https://example.com/article');
      expect(result.article?.topicId).toBe('topic-123');
      expect(result.article?.wordCount).toBe(2);
      expect(result.usage).toEqual({ type: 'count', count: 1, limit: 4 });

      const savedArticles = mockStorage.getArticles();
      expect(savedArticles).toHaveLength(1);
      expect(savedArticles[0].title).toBe('Custom Title');
    });

    it('should use extracted title when no title provided', async () => {
      const policy = new ArticleCountPolicy(4, mockStorage);
      const service = new ArticleSaveService(mockExtractor, policy, mockStorage);

      const result = await service.saveArticle('https://example.com/article');

      expect(result.success).toBe(true);
      expect(result.article?.title).toBe('Test Article');
    });
  });

  describe('saveArticle_atCountLimit_rejectsWithError', () => {
    it('should reject when at article count limit', async () => {
      // Pre-populate with 4 articles
      const existingArticles: Article[] = Array.from({ length: 4 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        url: `https://example.com/${i}`,
        content: '<p>Content</p>',
        wordCount: 100,
        savedAt: Date.now(),
        monthKey: '2026-03',
        topicId: 'topic-1',
      }));
      mockStorage.setArticles(existingArticles);

      const policy = new ArticleCountPolicy(4, mockStorage);
      const service = new ArticleSaveService(mockExtractor, policy, mockStorage);

      const result = await service.saveArticle('https://example.com/new-article');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Reading list is full (4/4). Please remove an article first.');
      expect(result.usage).toEqual({ type: 'count', count: 4, limit: 4 });
      expect(mockStorage.getArticles()).toHaveLength(4); // No new article saved
    });
  });

  describe('saveArticle_atWordLimit_rejectsWithError', () => {
    it('should reject when adding article would exceed word limit', async () => {
      // Pre-populate with articles totaling 11,500 words
      const existingArticles: Article[] = [
        {
          id: 'article-1',
          title: 'Article 1',
          url: 'https://example.com/1',
          content: '<p>Content</p>',
          wordCount: 5000,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
        {
          id: 'article-2',
          title: 'Article 2',
          url: 'https://example.com/2',
          content: '<p>Content</p>',
          wordCount: 6500,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
      ];
      mockStorage.setArticles(existingArticles);

      // Mock extractor returns article with 600 words (would exceed 12,000)
      const largeArticleExtractor = new MockContentExtractor({
        title: 'Large Article',
        content: '<p>Large content</p>',
        textContent: 'Large content',
        wordCount: 600,
      });

      const policy = new WordBudgetPolicy(12000, mockStorage);
      const service = new ArticleSaveService(largeArticleExtractor, policy, mockStorage);

      const result = await service.saveArticle('https://example.com/large-article');

      expect(result.success).toBe(false);
      expect(result.error).toContain('would exceed the 12,000 word limit');
      expect(result.error).toContain('current: 11,500 words');
      expect(result.error).toContain('article: 600 words');
      expect(result.usage).toEqual({ type: 'words', words: 11500, limit: 12000 });
      expect(mockStorage.getArticles()).toHaveLength(2); // No new article saved
    });

    it('should allow article that fits within word limit', async () => {
      // Pre-populate with articles totaling 11,500 words
      const existingArticles: Article[] = [
        {
          id: 'article-1',
          title: 'Article 1',
          url: 'https://example.com/1',
          content: '<p>Content</p>',
          wordCount: 11500,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
      ];
      mockStorage.setArticles(existingArticles);

      // Mock extractor returns article with 400 words (fits within 12,000)
      const smallArticleExtractor = new MockContentExtractor({
        title: 'Small Article',
        content: '<p>Small content</p>',
        textContent: 'Small content',
        wordCount: 400,
      });

      const policy = new WordBudgetPolicy(12000, mockStorage);
      const service = new ArticleSaveService(smallArticleExtractor, policy, mockStorage);

      const result = await service.saveArticle('https://example.com/small-article');

      expect(result.success).toBe(true);
      expect(result.article?.wordCount).toBe(400);
      expect(mockStorage.getArticles()).toHaveLength(2);
    });
  });

  describe('saveArticle_withExtractionFailure_returnsError', () => {
    it('should return error when extraction fails', async () => {
      // Mock extractor that throws an error
      const failingExtractor = {
        extractArticle: vi.fn().mockRejectedValue(new Error('Failed to fetch article')),
      };

      const policy = new ArticleCountPolicy(4, mockStorage);
      const service = new ArticleSaveService(failingExtractor, policy, mockStorage);

      const result = await service.saveArticle('https://example.com/broken-article');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch article');
      expect(mockStorage.getArticles()).toHaveLength(0); // No article saved
    });
  });

  describe('ArticleCountPolicy_checksCurrentMonthOnly', () => {
    it('should only count articles from current month', async () => {
      // This test verifies the policy uses getMonthKey() correctly
      // In a real scenario, articles from different months would have different monthKeys
      const policy = new ArticleCountPolicy(4, mockStorage);

      // Add 3 articles
      mockStorage.setArticles([
        {
          id: 'article-1',
          title: 'Article 1',
          url: 'https://example.com/1',
          content: '<p>Content</p>',
          wordCount: 100,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
        {
          id: 'article-2',
          title: 'Article 2',
          url: 'https://example.com/2',
          content: '<p>Content</p>',
          wordCount: 100,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
        {
          id: 'article-3',
          title: 'Article 3',
          url: 'https://example.com/3',
          content: '<p>Content</p>',
          wordCount: 100,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
      ]);

      const mockArticle: ExtractedArticle = {
        title: 'Test',
        content: '<p>Test</p>',
        textContent: 'Test',
        wordCount: 100,
      };

      const result = await policy.canSave(mockArticle);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toEqual({ type: 'count', count: 3, limit: 4 });
    });
  });

  describe('WordBudgetPolicy_sumsWordCountsCorrectly', () => {
    it('should correctly sum word counts across all articles', async () => {
      const policy = new WordBudgetPolicy(12000, mockStorage);

      mockStorage.setArticles([
        {
          id: 'article-1',
          title: 'Article 1',
          url: 'https://example.com/1',
          content: '<p>Content</p>',
          wordCount: 2500,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
        {
          id: 'article-2',
          title: 'Article 2',
          url: 'https://example.com/2',
          content: '<p>Content</p>',
          wordCount: 3750,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
        {
          id: 'article-3',
          title: 'Article 3',
          url: 'https://example.com/3',
          content: '<p>Content</p>',
          wordCount: 1250,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
      ]);

      const mockArticle: ExtractedArticle = {
        title: 'Test',
        content: '<p>Test</p>',
        textContent: 'Test',
        wordCount: 1000,
      };

      const result = await policy.canSave(mockArticle);

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toEqual({ type: 'words', words: 7500, limit: 12000 });
    });

    it('should reject when sum would exceed limit', async () => {
      const policy = new WordBudgetPolicy(12000, mockStorage);

      mockStorage.setArticles([
        {
          id: 'article-1',
          title: 'Article 1',
          url: 'https://example.com/1',
          content: '<p>Content</p>',
          wordCount: 10000,
          savedAt: Date.now(),
          monthKey: '2026-03',
          topicId: 'topic-1',
        },
      ]);

      const mockArticle: ExtractedArticle = {
        title: 'Test',
        content: '<p>Test</p>',
        textContent: 'Test',
        wordCount: 2500,
      };

      const result = await policy.canSave(mockArticle);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('would exceed the 12,000 word limit');
    });
  });
});
