// Storage service factory and backward-compatible exports
// This file maintains the original API while supporting both local and cloud storage

import type { StorageBackend } from './types';
import { LocalStorageBackend } from './local';
import { SupabaseStorageBackend } from './supabase';
import { StorageDomain } from './domain';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types';

// Storage mode: 'local' or 'cloud'
// Defaults to 'local' if Supabase is not configured
const storageMode = import.meta.env.VITE_STORAGE_MODE || 'local';

// Singleton storage backend instance
let storageBackend: StorageBackend | null = null;

// Singleton domain instance
let storageDomain: StorageDomain | null = null;

function getStorageBackend(): StorageBackend {
  if (storageBackend) return storageBackend;

  // Determine which backend to use
  if (storageMode === 'cloud' && isSupabaseConfigured()) {
    const supabaseClient = getSupabaseClient();
    if (supabaseClient) {
      console.log('Using Supabase storage backend');
      storageBackend = new SupabaseStorageBackend(supabaseClient);
      return storageBackend;
    }
  }

  // Default to local storage
  console.log('Using local storage backend');
  storageBackend = new LocalStorageBackend();
  return storageBackend;
}

function getStorageDomain(): StorageDomain {
  if (storageDomain) return storageDomain;
  
  storageDomain = new StorageDomain(getStorageBackend());
  return storageDomain;
}

// Backward-compatible exports - these maintain the original API
export async function getSettings(): Promise<Settings | null> {
  return getStorageBackend().getSettings();
}

export async function saveSettings(settings: Settings): Promise<void> {
  return getStorageBackend().saveSettings(settings);
}

export async function saveArticle(article: Article): Promise<void> {
  return getStorageBackend().saveArticle(article);
}

export async function getArticlesByMonth(monthKey: string): Promise<Article[]> {
  return getStorageBackend().getArticlesByMonth(monthKey);
}

export async function deleteArticle(id: string): Promise<void> {
  return getStorageBackend().deleteArticle(id);
}

export async function getAllArticles(): Promise<Article[]> {
  return getStorageBackend().getAllArticles();
}

export async function saveSummary(summary: DailySummary): Promise<void> {
  return getStorageBackend().saveSummary(summary);
}

export async function getSummaryByTopic(topicId: string): Promise<DailySummary | null> {
  return getStorageBackend().getSummaryByTopic(topicId);
}

export async function getAllSummaries(): Promise<DailySummary[]> {
  return getStorageBackend().getAllSummaries();
}

export async function deleteSummary(id: string): Promise<void> {
  return getStorageBackend().deleteSummary(id);
}

export async function cleanupExpiredSummaries(): Promise<void> {
  return getStorageBackend().cleanupExpiredSummaries();
}

export async function logTopicActivity(topicId: string, topicName: string): Promise<void> {
  return getStorageBackend().logTopicActivity(topicId, topicName);
}

export async function getActiveTopicIdsForQuarter(quarter: string): Promise<string[]> {
  return getStorageBackend().getActiveTopicIdsForQuarter(quarter);
}

export async function saveBookList(bookList: QuarterlyBookList): Promise<void> {
  return getStorageBackend().saveBookList(bookList);
}

export async function getBookListByQuarterAndTopic(quarter: string, topicId: string): Promise<QuarterlyBookList | null> {
  return getStorageBackend().getBookListByQuarterAndTopic(quarter, topicId);
}

export async function getBookListsByQuarter(quarter: string): Promise<QuarterlyBookList[]> {
  return getStorageBackend().getBookListsByQuarter(quarter);
}

// Utility functions (unchanged from original)
export async function getCurrentQuarter(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `${year}-Q${quarter}`;
}

export function getMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// DOMAIN-LEVEL EXPORTS (New - recommended for most use cases)
// ============================================================================

// Summary operations
export async function getTodaysSummary(topicId: string): Promise<DailySummary | null> {
  return getStorageDomain().getTodaysSummary(topicId);
}

export async function saveSummaryWithCleanup(summary: DailySummary): Promise<void> {
  return getStorageDomain().saveSummaryWithCleanup(summary);
}

// Article operations
export async function getCurrentMonthArticles(topicId?: string): Promise<Article[]> {
  return getStorageDomain().getCurrentMonthArticles(topicId);
}

// Book operations
export async function getCurrentQuarterBooks(topicId: string): Promise<QuarterlyBookList | null> {
  return getStorageDomain().getCurrentQuarterBooks(topicId);
}

export async function saveQuarterBooks(bookList: QuarterlyBookList): Promise<void> {
  return getStorageDomain().saveQuarterBooks(bookList);
}

// ============================================================================
// BACKEND-LEVEL EXPORTS (Backward compatible - for advanced usage)
// ============================================================================

// Export the backend and domain for advanced usage
export { getStorageBackend, getStorageDomain };
export type { StorageBackend } from './types';
export type { StorageDomain } from './domain';
