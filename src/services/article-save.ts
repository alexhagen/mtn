// Article save service with Ports & Adapters architecture
// Consolidates duplicated save logic from DailySummary.tsx and ReadingList.tsx

import { extractArticleContent, countWords } from './readability';
import type { Article } from '../types';

// ============================================================================
// PORTS (Interfaces for cross-boundary dependencies)
// ============================================================================

/**
 * Port: Content extraction abstraction
 * Abstracts the CORS proxy boundary for testing
 */
export interface ContentExtractor {
  extractArticle(url: string): Promise<ExtractedArticle>;
}

export interface ExtractedArticle {
  title: string;
  content: string;
  textContent: string;
  wordCount: number;
}

/**
 * Port: Limit enforcement strategy
 * Allows different limit policies (count-based, word-based)
 */
export interface ArticleLimitPolicy {
  canSave(article: ExtractedArticle): Promise<LimitCheckResult>;
}

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: UsageInfo;
}

export type UsageInfo = 
  | { type: 'count'; count: number; limit: number }
  | { type: 'words'; words: number; limit: number };

/**
 * Storage operations needed by the service
 */
export interface ArticleStorage {
  saveArticle(article: Article): Promise<void>;
  getArticlesByMonth(monthKey: string): Promise<Article[]>;
  getMonthKey(): string;
  generateId(): string;
}

// ============================================================================
// ADAPTERS (Implementations)
// ============================================================================

/**
 * Production adapter: Real CORS proxy extraction
 */
export class ReadabilityContentExtractor implements ContentExtractor {
  constructor(private corsProxyUrl: string) {}

  async extractArticle(url: string): Promise<ExtractedArticle> {
    const extracted = await extractArticleContent(url, this.corsProxyUrl);
    const wordCount = countWords(extracted.textContent);
    
    return {
      title: extracted.title,
      content: extracted.content,
      textContent: extracted.textContent,
      wordCount,
    };
  }
}

/**
 * Test adapter: Mock extractor for fast tests
 */
export class MockContentExtractor implements ContentExtractor {
  constructor(
    private mockArticle: ExtractedArticle = {
      title: 'Test Article',
      content: '<p>Test content</p>',
      textContent: 'Test content',
      wordCount: 2,
    }
  ) {}

  async extractArticle(_url: string): Promise<ExtractedArticle> {
    return this.mockArticle;
  }
}

// ============================================================================
// LIMIT POLICIES
// ============================================================================

/**
 * Enforces a maximum article count per month
 * Used by DailySummary (4 articles)
 */
export class ArticleCountPolicy implements ArticleLimitPolicy {
  constructor(
    private maxArticles: number,
    private storage: Pick<ArticleStorage, 'getArticlesByMonth' | 'getMonthKey'>
  ) {}

  async canSave(_article: ExtractedArticle): Promise<LimitCheckResult> {
    const monthKey = this.storage.getMonthKey();
    const currentArticles = await this.storage.getArticlesByMonth(monthKey);
    const currentCount = currentArticles.length;

    if (currentCount >= this.maxArticles) {
      return {
        allowed: false,
        reason: `Reading list is full (${currentCount}/${this.maxArticles}). Please remove an article first.`,
        currentUsage: { type: 'count', count: currentCount, limit: this.maxArticles },
      };
    }

    return {
      allowed: true,
      currentUsage: { type: 'count', count: currentCount, limit: this.maxArticles },
    };
  }
}

/**
 * Enforces a maximum word budget per month
 * Used by ReadingList (12,000 words)
 */
export class WordBudgetPolicy implements ArticleLimitPolicy {
  constructor(
    private maxWords: number,
    private storage: Pick<ArticleStorage, 'getArticlesByMonth' | 'getMonthKey'>
  ) {}

  async canSave(article: ExtractedArticle): Promise<LimitCheckResult> {
    const monthKey = this.storage.getMonthKey();
    const currentArticles = await this.storage.getArticlesByMonth(monthKey);
    const currentWords = currentArticles.reduce((sum, a) => sum + a.wordCount, 0);

    if (currentWords + article.wordCount > this.maxWords) {
      return {
        allowed: false,
        reason: `Adding this article would exceed the ${this.maxWords.toLocaleString()} word limit (current: ${currentWords.toLocaleString()} words, article: ${article.wordCount.toLocaleString()} words). Please remove some articles first.`,
        currentUsage: { type: 'words', words: currentWords, limit: this.maxWords },
      };
    }

    return {
      allowed: true,
      currentUsage: { type: 'words', words: currentWords, limit: this.maxWords },
    };
  }
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export interface SaveResult {
  success: boolean;
  error?: string;
  article?: Article;
  usage?: UsageInfo;
}

/**
 * Article save service
 * Orchestrates: extract → check limit → construct Article → persist
 */
export class ArticleSaveService {
  constructor(
    private extractor: ContentExtractor,
    private policy: ArticleLimitPolicy,
    private storage: ArticleStorage
  ) {}

  async saveArticle(
    url: string,
    title?: string,
    topicId?: string
  ): Promise<SaveResult> {
    try {
      // Step 1: Extract article content
      const extracted = await this.extractor.extractArticle(url);

      // Step 2: Check limit
      const limitCheck = await this.policy.canSave(extracted);
      if (!limitCheck.allowed) {
        return {
          success: false,
          error: limitCheck.reason,
          usage: limitCheck.currentUsage,
        };
      }

      // Step 3: Construct Article object
      const monthKey = this.storage.getMonthKey();
      const article: Article = {
        id: this.storage.generateId(),
        title: title || extracted.title,
        url,
        content: extracted.content,
        wordCount: extracted.wordCount,
        savedAt: Date.now(),
        monthKey,
        topicId,
      };

      // Step 4: Persist
      await this.storage.saveArticle(article);

      // Step 5: Return success with updated usage
      const updatedCheck = await this.policy.canSave(extracted);
      return {
        success: true,
        article,
        usage: updatedCheck.currentUsage,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save article',
      };
    }
  }
}
