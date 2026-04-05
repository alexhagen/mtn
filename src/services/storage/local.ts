// Local storage backend using AsyncStorage
// This replaces the IndexedDB implementation for React Native compatibility

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types';
import type { StorageBackend } from './types';

interface TopicActivity {
  id: string;
  topicId: string;
  topicName: string;
  generatedAt: string; // ISO date string (YYYY-MM-DD)
}

const KEYS = {
  SETTINGS: '@mtn:settings',
  ARTICLES: '@mtn:articles',
  SUMMARIES: '@mtn:summaries',
  BOOK_LISTS: '@mtn:bookLists',
  TOPIC_ACTIVITY: '@mtn:topicActivity',
};

export class LocalStorageBackend implements StorageBackend {
  // Settings operations
  async getSettings(): Promise<Settings | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  // Article operations
  async saveArticle(article: Article): Promise<void> {
    try {
      const articles = await this.getAllArticles();
      const index = articles.findIndex(a => a.id === article.id);
      
      if (index >= 0) {
        articles[index] = article;
      } else {
        articles.push(article);
      }
      
      await AsyncStorage.setItem(KEYS.ARTICLES, JSON.stringify(articles));
    } catch (error) {
      console.error('Error saving article:', error);
      throw error;
    }
  }

  async getArticlesByMonth(monthKey: string): Promise<Article[]> {
    try {
      const articles = await this.getAllArticles();
      return articles.filter(a => a.monthKey === monthKey);
    } catch (error) {
      console.error('Error getting articles by month:', error);
      return [];
    }
  }

  async deleteArticle(id: string): Promise<void> {
    try {
      const articles = await this.getAllArticles();
      const filtered = articles.filter(a => a.id !== id);
      await AsyncStorage.setItem(KEYS.ARTICLES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting article:', error);
      throw error;
    }
  }

  async getAllArticles(): Promise<Article[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.ARTICLES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting all articles:', error);
      return [];
    }
  }

  // Summary operations
  async saveSummary(summary: DailySummary): Promise<void> {
    try {
      const summaries = await this.getAllSummaries();
      const index = summaries.findIndex(s => s.id === summary.id);
      
      if (index >= 0) {
        summaries[index] = summary;
      } else {
        summaries.push(summary);
      }
      
      await AsyncStorage.setItem(KEYS.SUMMARIES, JSON.stringify(summaries));
    } catch (error) {
      console.error('Error saving summary:', error);
      throw error;
    }
  }

  async getSummaryByTopic(topicId: string): Promise<DailySummary | null> {
    try {
      const summaries = await this.getAllSummaries();
      const now = Date.now();
      
      // Filter by topic and non-expired
      const validSummaries = summaries.filter(
        s => s.topicId === topicId && s.expiresAt > now
      );
      
      if (validSummaries.length === 0) return null;
      
      // Return most recent
      return validSummaries.sort((a, b) => b.generatedAt - a.generatedAt)[0];
    } catch (error) {
      console.error('Error getting summary by topic:', error);
      return null;
    }
  }

  async getAllSummaries(): Promise<DailySummary[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SUMMARIES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting all summaries:', error);
      return [];
    }
  }

  async deleteSummary(id: string): Promise<void> {
    try {
      const summaries = await this.getAllSummaries();
      const filtered = summaries.filter(s => s.id !== id);
      await AsyncStorage.setItem(KEYS.SUMMARIES, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting summary:', error);
      throw error;
    }
  }

  async cleanupExpiredSummaries(): Promise<void> {
    try {
      const summaries = await this.getAllSummaries();
      const now = Date.now();
      const valid = summaries.filter(s => s.expiresAt >= now);
      await AsyncStorage.setItem(KEYS.SUMMARIES, JSON.stringify(valid));
    } catch (error) {
      console.error('Error cleaning up expired summaries:', error);
    }
  }

  // Topic activity operations
  async logTopicActivity(topicId: string, topicName: string): Promise<void> {
    try {
      const activities = await this.getAllTopicActivities();
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const id = `${topicId}-${today}`;
      
      const index = activities.findIndex(a => a.id === id);
      const activity: TopicActivity = { id, topicId, topicName, generatedAt: today };
      
      if (index >= 0) {
        activities[index] = activity;
      } else {
        activities.push(activity);
      }
      
      await AsyncStorage.setItem(KEYS.TOPIC_ACTIVITY, JSON.stringify(activities));
    } catch (error) {
      console.error('Error logging topic activity:', error);
    }
  }

  async getActiveTopicIdsForQuarter(quarter: string): Promise<string[]> {
    try {
      const activities = await this.getAllTopicActivities();
      
      // Parse quarter to get date range
      const [year, q] = quarter.split('-Q');
      const quarterNum = parseInt(q);
      const startMonth = (quarterNum - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      
      const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;
      
      // Filter activities in date range
      const activeInQuarter = activities.filter(
        activity => activity.generatedAt >= startDate && activity.generatedAt <= endDate
      );
      
      // Return unique topic IDs
      const uniqueTopicIds = [...new Set(activeInQuarter.map(a => a.topicId))];
      return uniqueTopicIds;
    } catch (error) {
      console.error('Error getting active topic IDs for quarter:', error);
      return [];
    }
  }

  private async getAllTopicActivities(): Promise<TopicActivity[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.TOPIC_ACTIVITY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting all topic activities:', error);
      return [];
    }
  }

  // Book list operations (per-topic)
  async saveBookList(bookList: QuarterlyBookList): Promise<void> {
    try {
      const bookLists = await this.getAllBookLists();
      const index = bookLists.findIndex(b => b.id === bookList.id);
      
      if (index >= 0) {
        bookLists[index] = bookList;
      } else {
        bookLists.push(bookList);
      }
      
      await AsyncStorage.setItem(KEYS.BOOK_LISTS, JSON.stringify(bookLists));
    } catch (error) {
      console.error('Error saving book list:', error);
      throw error;
    }
  }

  async getBookListByQuarterAndTopic(quarter: string, topicId: string): Promise<QuarterlyBookList | null> {
    try {
      const bookLists = await this.getAllBookLists();
      return bookLists.find(b => b.quarter === quarter && b.topicId === topicId) || null;
    } catch (error) {
      console.error('Error getting book list by quarter and topic:', error);
      return null;
    }
  }

  async getBookListsByQuarter(quarter: string): Promise<QuarterlyBookList[]> {
    try {
      const bookLists = await this.getAllBookLists();
      return bookLists.filter(b => b.quarter === quarter);
    } catch (error) {
      console.error('Error getting book lists by quarter:', error);
      return [];
    }
  }

  private async getAllBookLists(): Promise<QuarterlyBookList[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.BOOK_LISTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting all book lists:', error);
      return [];
    }
  }
}
