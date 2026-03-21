// Storage backend interface for MTN
// Supports both local (IndexedDB) and cloud (Supabase) storage

import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types';

export interface StorageBackend {
  // Settings operations
  getSettings(): Promise<Settings | null>;
  saveSettings(settings: Settings): Promise<void>;

  // Article operations
  saveArticle(article: Article): Promise<void>;
  getArticlesByMonth(monthKey: string): Promise<Article[]>;
  deleteArticle(id: string): Promise<void>;
  getAllArticles(): Promise<Article[]>;

  // Summary operations (synced to cloud with 7-day retention)
  saveSummary(summary: DailySummary): Promise<void>;
  getSummaryByTopic(topicId: string): Promise<DailySummary | null>;
  getAllSummaries(): Promise<DailySummary[]>;
  deleteSummary(id: string): Promise<void>;
  cleanupExpiredSummaries(): Promise<void>;

  // Book list operations
  saveBookList(bookList: QuarterlyBookList): Promise<void>;
  getBookListByQuarter(quarter: string): Promise<QuarterlyBookList | null>;
}
