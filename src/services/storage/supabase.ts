// Supabase storage backend
// Syncs data to Supabase Postgres with Row-Level Security

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Settings, Article, DailySummary, QuarterlyBookList } from '../../types';
import type { StorageBackend } from './types';
import { LocalStorageBackend } from './local';

// Database row types
interface UserSettingsRow {
  user_id: string;
  anthropic_api_key_encrypted: string;
  cors_proxy_url: string;
  daily_summary_system_prompt: string | null;
  daily_summary_user_prompt: string | null;
  book_rec_system_prompt: string | null;
  book_rec_user_prompt: string | null;
  created_at: string;
  updated_at: string;
}

interface TopicRow {
  id: string;
  user_id: string;
  name: string;
  rss_feeds: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

interface ArticleRow {
  id: string;
  user_id: string;
  title: string;
  url: string;
  content: string | null;
  word_count: number | null;
  month_key: string;
  saved_at: string;
}

interface BookListRow {
  id: string;
  user_id: string;
  quarter: string;
  books: any; // JSONB
  generated_at: string;
}

export class SupabaseStorageBackend implements StorageBackend {
  private client: SupabaseClient;
  private localBackend: LocalStorageBackend;

  constructor(client: SupabaseClient) {
    this.client = client;
    // Use local backend for summaries (not synced)
    this.localBackend = new LocalStorageBackend();
  }

  // Settings operations
  async getSettings(): Promise<Settings | null> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) return null;

      // Fetch user settings
      const { data: settingsData, error: settingsError } = await this.client
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settingsError) {
        if (settingsError.code === 'PGRST116') {
          // No settings found, return null
          return null;
        }
        throw settingsError;
      }

      // Fetch topics
      const { data: topicsData, error: topicsError } = await this.client
        .from('topics')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (topicsError) throw topicsError;

      const settings = settingsData as UserSettingsRow;
      const topics = (topicsData || []) as TopicRow[];

      // Decrypt API key (for now, just use as-is - encryption in Phase 4)
      const apiKey = await this.decryptApiKey(settings.anthropic_api_key_encrypted);

      return {
        anthropicApiKey: apiKey,
        corsProxyUrl: settings.cors_proxy_url,
        topics: topics.map(t => ({
          id: t.id,
          name: t.name,
          rssFeeds: t.rss_feeds,
        })),
        dailySummarySystemPrompt: settings.daily_summary_system_prompt || undefined,
        dailySummaryUserPrompt: settings.daily_summary_user_prompt || undefined,
        bookRecommendationsSystemPrompt: settings.book_rec_system_prompt || undefined,
        bookRecommendationsUserPrompt: settings.book_rec_user_prompt || undefined,
      };
    } catch (error) {
      console.error('Error fetching settings from Supabase:', error);
      throw error;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Encrypt API key (for now, just use as-is - encryption in Phase 4)
      const encryptedApiKey = await this.encryptApiKey(settings.anthropicApiKey);

      // Upsert user settings
      const { error: settingsError } = await this.client
        .from('user_settings')
        .upsert({
          user_id: user.id,
          anthropic_api_key_encrypted: encryptedApiKey,
          cors_proxy_url: settings.corsProxyUrl,
          daily_summary_system_prompt: settings.dailySummarySystemPrompt || null,
          daily_summary_user_prompt: settings.dailySummaryUserPrompt || null,
          book_rec_system_prompt: settings.bookRecommendationsSystemPrompt || null,
          book_rec_user_prompt: settings.bookRecommendationsUserPrompt || null,
          updated_at: new Date().toISOString(),
        });

      if (settingsError) throw settingsError;

      // Get existing topics to determine what to delete
      const { data: existingTopics } = await this.client
        .from('topics')
        .select('id')
        .eq('user_id', user.id);

      const existingIds = (existingTopics || []).map((t: any) => t.id);
      const newIds = settings.topics.map(t => t.id);
      const toDelete = existingIds.filter(id => !newIds.includes(id));

      // Delete removed topics
      if (toDelete.length > 0) {
        const { error: deleteError } = await this.client
          .from('topics')
          .delete()
          .in('id', toDelete);

        if (deleteError) throw deleteError;
      }

      // Upsert topics
      for (let i = 0; i < settings.topics.length; i++) {
        const topic = settings.topics[i];
        const { error: topicError } = await this.client
          .from('topics')
          .upsert({
            id: topic.id,
            user_id: user.id,
            name: topic.name,
            rss_feeds: topic.rssFeeds,
            position: i,
            updated_at: new Date().toISOString(),
          });

        if (topicError) throw topicError;
      }
    } catch (error) {
      console.error('Error saving settings to Supabase:', error);
      throw error;
    }
  }

  // Article operations
  async saveArticle(article: Article): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await this.client
        .from('articles')
        .upsert({
          id: article.id,
          user_id: user.id,
          title: article.title,
          url: article.url,
          content: article.content,
          word_count: article.wordCount,
          month_key: article.monthKey,
          saved_at: new Date(article.savedAt).toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving article to Supabase:', error);
      throw error;
    }
  }

  async getArticlesByMonth(monthKey: string): Promise<Article[]> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) return [];

      const { data, error } = await this.client
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_key', monthKey)
        .order('saved_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: ArticleRow) => ({
        id: row.id,
        title: row.title,
        url: row.url,
        content: row.content || '',
        wordCount: row.word_count || 0,
        monthKey: row.month_key,
        savedAt: new Date(row.saved_at).getTime(),
      }));
    } catch (error) {
      console.error('Error fetching articles from Supabase:', error);
      throw error;
    }
  }

  async deleteArticle(id: string): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await this.client
        .from('articles')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting article from Supabase:', error);
      throw error;
    }
  }

  async getAllArticles(): Promise<Article[]> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) return [];

      const { data, error } = await this.client
        .from('articles')
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: ArticleRow) => ({
        id: row.id,
        title: row.title,
        url: row.url,
        content: row.content || '',
        wordCount: row.word_count || 0,
        monthKey: row.month_key,
        savedAt: new Date(row.saved_at).getTime(),
      }));
    } catch (error) {
      console.error('Error fetching all articles from Supabase:', error);
      throw error;
    }
  }

  // Summary operations (delegated to local backend - not synced)
  async saveSummary(summary: DailySummary): Promise<void> {
    return this.localBackend.saveSummary(summary);
  }

  async getSummaryByTopic(topicId: string): Promise<DailySummary | null> {
    return this.localBackend.getSummaryByTopic(topicId);
  }

  async getAllSummaries(): Promise<DailySummary[]> {
    return this.localBackend.getAllSummaries();
  }

  async deleteSummary(id: string): Promise<void> {
    return this.localBackend.deleteSummary(id);
  }

  // Book list operations
  async saveBookList(bookList: QuarterlyBookList): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await this.client
        .from('book_lists')
        .upsert({
          id: bookList.id,
          user_id: user.id,
          quarter: bookList.quarter,
          books: bookList.books,
          generated_at: new Date(bookList.generatedAt).toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving book list to Supabase:', error);
      throw error;
    }
  }

  async getBookListByQuarter(quarter: string): Promise<QuarterlyBookList | null> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) return null;

      const { data, error } = await this.client
        .from('book_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('quarter', quarter)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No book list found
          return null;
        }
        throw error;
      }

      const row = data as BookListRow;
      return {
        id: row.id,
        quarter: row.quarter,
        books: row.books,
        generatedAt: new Date(row.generated_at).getTime(),
      };
    } catch (error) {
      console.error('Error fetching book list from Supabase:', error);
      throw error;
    }
  }

  // Encryption helpers using Web Crypto API
  private async encryptApiKey(apiKey: string): Promise<string> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Use proper encryption with user ID as session key
    const { encryptApiKey, getSessionKey } = await import('../encryption');
    const sessionKey = getSessionKey(user.id);
    return encryptApiKey(apiKey, sessionKey);
  }

  private async decryptApiKey(encrypted: string): Promise<string> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Try proper decryption first
    try {
      const { decryptApiKey, getSessionKey } = await import('../encryption');
      const sessionKey = getSessionKey(user.id);
      return decryptApiKey(encrypted, sessionKey);
    } catch (error) {
      // Fallback for legacy base64-encoded keys (migration path)
      try {
        return atob(encrypted);
      } catch {
        // If both fail, assume it's already decrypted
        return encrypted;
      }
    }
  }
}
