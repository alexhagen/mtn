// Local storage backend using IndexedDB
// This is the original storage implementation, now wrapped in a class

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types';
import type { StorageBackend } from './types';

interface MNTDatabase extends DBSchema {
  settings: {
    key: string;
    value: Settings;
  };
  articles: {
    key: string;
    value: Article;
    indexes: { 'by-month': string };
  };
  summaries: {
    key: string;
    value: DailySummary;
    indexes: { 'by-topic': string };
  };
  bookLists: {
    key: string;
    value: QuarterlyBookList;
  };
}

const DB_NAME = 'mtn-db';
const DB_VERSION = 1;

export class LocalStorageBackend implements StorageBackend {
  private dbInstance: IDBPDatabase<MNTDatabase> | null = null;

  private async getDB(): Promise<IDBPDatabase<MNTDatabase>> {
    if (this.dbInstance) return this.dbInstance;

    this.dbInstance = await openDB<MNTDatabase>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        // Articles store
        if (!db.objectStoreNames.contains('articles')) {
          const articleStore = db.createObjectStore('articles', { keyPath: 'id' });
          articleStore.createIndex('by-month', 'monthKey');
        }

        // Summaries store
        if (!db.objectStoreNames.contains('summaries')) {
          const summaryStore = db.createObjectStore('summaries', { keyPath: 'id' });
          summaryStore.createIndex('by-topic', 'topicId');
        }

        // Book lists store
        if (!db.objectStoreNames.contains('bookLists')) {
          db.createObjectStore('bookLists', { keyPath: 'id' });
        }
      },
    });

    return this.dbInstance;
  }

  // Settings operations
  async getSettings(): Promise<Settings | null> {
    const db = await this.getDB();
    return (await db.get('settings', 'current')) || null;
  }

  async saveSettings(settings: Settings): Promise<void> {
    const db = await this.getDB();
    await db.put('settings', settings, 'current');
  }

  // Article operations
  async saveArticle(article: Article): Promise<void> {
    const db = await this.getDB();
    await db.put('articles', article);
  }

  async getArticlesByMonth(monthKey: string): Promise<Article[]> {
    const db = await this.getDB();
    return await db.getAllFromIndex('articles', 'by-month', monthKey);
  }

  async deleteArticle(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('articles', id);
  }

  async getAllArticles(): Promise<Article[]> {
    const db = await this.getDB();
    return await db.getAll('articles');
  }

  // Summary operations
  async saveSummary(summary: DailySummary): Promise<void> {
    const db = await this.getDB();
    await db.put('summaries', summary);
  }

  async getSummaryByTopic(topicId: string): Promise<DailySummary | null> {
    const db = await this.getDB();
    const summaries = await db.getAllFromIndex('summaries', 'by-topic', topicId);
    
    // Return the most recent non-expired summary
    const now = Date.now();
    const validSummaries = summaries.filter(s => s.expiresAt > now);
    
    if (validSummaries.length === 0) return null;
    
    return validSummaries.sort((a, b) => b.generatedAt - a.generatedAt)[0];
  }

  async getAllSummaries(): Promise<DailySummary[]> {
    const db = await this.getDB();
    return await db.getAll('summaries');
  }

  async deleteSummary(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete('summaries', id);
  }

  // Book list operations
  async saveBookList(bookList: QuarterlyBookList): Promise<void> {
    const db = await this.getDB();
    await db.put('bookLists', bookList);
  }

  async getBookListByQuarter(quarter: string): Promise<QuarterlyBookList | null> {
    const db = await this.getDB();
    return (await db.get('bookLists', quarter)) || null;
  }
}
