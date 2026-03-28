// Local storage backend using IndexedDB
// This is the original storage implementation, now wrapped in a class

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types';
import type { StorageBackend } from './types';

interface TopicActivity {
  id: string;
  topicId: string;
  topicName: string;
  generatedAt: string; // ISO date string (YYYY-MM-DD)
}

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
    indexes: { 'by-quarter': string; 'by-topic': string };
  };
  topicActivity: {
    key: string;
    value: TopicActivity;
    indexes: { 'by-date': string; 'by-topic': string };
  };
}

const DB_NAME = 'mtn-db';
const DB_VERSION = 2; // Incremented for new stores and indexes

export class LocalStorageBackend implements StorageBackend {
  private dbInstance: IDBPDatabase<MNTDatabase> | null = null;

  private async getDB(): Promise<IDBPDatabase<MNTDatabase>> {
    if (this.dbInstance) return this.dbInstance;

    this.dbInstance = await openDB<MNTDatabase>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
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
          const bookListStore = db.createObjectStore('bookLists', { keyPath: 'id' });
          bookListStore.createIndex('by-quarter', 'quarter');
          bookListStore.createIndex('by-topic', 'topicId');
        } else if (oldVersion < 2) {
          // Add indexes to existing bookLists store
          const bookListStore = db.transaction!.objectStore('bookLists');
          if (!bookListStore.indexNames.contains('by-quarter')) {
            bookListStore.createIndex('by-quarter', 'quarter');
          }
          if (!bookListStore.indexNames.contains('by-topic')) {
            bookListStore.createIndex('by-topic', 'topicId');
          }
        }

        // Topic activity store (new in v2)
        if (!db.objectStoreNames.contains('topicActivity')) {
          const activityStore = db.createObjectStore('topicActivity', { keyPath: 'id' });
          activityStore.createIndex('by-date', 'generatedAt');
          activityStore.createIndex('by-topic', 'topicId');
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

  async cleanupExpiredSummaries(): Promise<void> {
    const db = await this.getDB();
    const allSummaries = await db.getAll('summaries');
    const now = Date.now();
    
    // Delete expired summaries
    for (const summary of allSummaries) {
      if (summary.expiresAt < now) {
        await db.delete('summaries', summary.id);
      }
    }
  }

  // Topic activity operations
  async logTopicActivity(topicId: string, topicName: string): Promise<void> {
    const db = await this.getDB();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const id = `${topicId}-${today}`;
    
    // Upsert - only one entry per topic per day
    await db.put('topicActivity', {
      id,
      topicId,
      topicName,
      generatedAt: today,
    });
  }

  async getActiveTopicIdsForQuarter(quarter: string): Promise<string[]> {
    const db = await this.getDB();
    
    // Parse quarter to get date range
    const [year, q] = quarter.split('-Q');
    const quarterNum = parseInt(q);
    const startMonth = (quarterNum - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;
    
    // Get all activities in date range
    const allActivities = await db.getAll('topicActivity');
    const activeInQuarter = allActivities.filter(
      activity => activity.generatedAt >= startDate && activity.generatedAt <= endDate
    );
    
    // Return unique topic IDs
    const uniqueTopicIds = [...new Set(activeInQuarter.map(a => a.topicId))];
    return uniqueTopicIds;
  }

  // Book list operations (per-topic)
  async saveBookList(bookList: QuarterlyBookList): Promise<void> {
    const db = await this.getDB();
    await db.put('bookLists', bookList);
  }

  async getBookListByQuarterAndTopic(quarter: string, topicId: string): Promise<QuarterlyBookList | null> {
    const db = await this.getDB();
    const allLists = await db.getAllFromIndex('bookLists', 'by-quarter', quarter);
    return allLists.find(list => list.topicId === topicId) || null;
  }

  async getBookListsByQuarter(quarter: string): Promise<QuarterlyBookList[]> {
    const db = await this.getDB();
    return await db.getAllFromIndex('bookLists', 'by-quarter', quarter);
  }
}
