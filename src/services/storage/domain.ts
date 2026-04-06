// Domain-focused storage operations
// Hides low-level CRUD complexity behind intention-revealing methods

import type { StorageBackend } from './types';
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types';

/**
 * StorageDomain - A deeper module that hides storage complexity
 * 
 * Design principles:
 * - Exposes domain operations (getTodaysSummary) not CRUD (getSummaryByTopic + expiry check)
 * - Hides month/quarter key generation
 * - Automatic cleanup operations
 * - Topic-aware filtering
 * 
 * The backend is exposed for advanced operations (getAllSummaries, deleteArticle, etc.)
 */
export class StorageDomain {
  constructor(public readonly backend: StorageBackend) {}

  // ============================================================================
  // SUMMARY OPERATIONS
  // ============================================================================

  /**
   * Get today's cached summary for a topic
   * Hides: expiry checking (already in backend), null handling
   */
  async getTodaysSummary(topicId: string): Promise<DailySummary | null> {
    return this.backend.getSummaryByTopic(topicId);
  }

  /**
   * Get recent summaries for a topic (up to limit)
   * Hides: expiry checking, sorting
   */
  async getRecentSummaries(topicId: string, limit: number = 7): Promise<DailySummary[]> {
    const summaries = await this.backend.getSummariesByTopic(topicId);
    return summaries.slice(0, limit);
  }

  /**
   * Save summary and cleanup expired ones
   * Hides: cleanup operation that should always happen after save
   */
  async saveSummaryWithCleanup(summary: DailySummary): Promise<void> {
    await this.backend.saveSummary(summary);
    await this.backend.cleanupExpiredSummaries();
  }

  // ============================================================================
  // ARTICLE OPERATIONS
  // ============================================================================

  /**
   * Get articles from current month, optionally filtered by topic
   * Hides: month key generation, topic filtering
   */
  async getCurrentMonthArticles(topicId?: string): Promise<Article[]> {
    const monthKey = this.getMonthKey();
    const articles = await this.backend.getArticlesByMonth(monthKey);
    
    if (topicId) {
      return articles.filter(a => a.topicId === topicId);
    }
    
    return articles;
  }

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================

  /**
   * Get user settings
   * Simple passthrough - no domain logic needed
   */
  async getSettings(): Promise<Settings | null> {
    return this.backend.getSettings();
  }

  /**
   * Save user settings
   * Simple passthrough - no domain logic needed
   */
  async saveSettings(settings: Settings): Promise<void> {
    return this.backend.saveSettings(settings);
  }

  // ============================================================================
  // BOOK OPERATIONS
  // ============================================================================

  /**
   * Get book list for current quarter and topic
   * Hides: quarter key generation
   */
  async getCurrentQuarterBooks(topicId: string): Promise<QuarterlyBookList | null> {
    const quarter = await this.getCurrentQuarter();
    return this.backend.getBookListByQuarterAndTopic(quarter, topicId);
  }

  /**
   * Save book list for a quarter
   * Simple passthrough - no domain logic needed
   */
  async saveQuarterBooks(bookList: QuarterlyBookList): Promise<void> {
    return this.backend.saveBookList(bookList);
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Generate a unique ID
   */
  generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get month key for current date (YYYY-MM)
   */
  getMonthKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get current quarter (YYYY-Q1, YYYY-Q2, etc.)
   */
  async getCurrentQuarter(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
  }
}
