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
  getSummariesByTopic(topicId: string): Promise<DailySummary[]>;
  getAllSummaries(): Promise<DailySummary[]>;
  deleteSummary(id: string): Promise<void>;
  cleanupExpiredSummaries(): Promise<void>;

  // Topic activity operations
  logTopicActivity(topicId: string, topicName: string): Promise<void>;
  getActiveTopicIdsForQuarter(quarter: string): Promise<string[]>;

  // Book list operations (per-topic)
  saveBookList(bookList: QuarterlyBookList): Promise<void>;
  getBookListByQuarterAndTopic(quarter: string, topicId: string): Promise<QuarterlyBookList | null>;
  getBookListsByQuarter(quarter: string): Promise<QuarterlyBookList[]>;
}
