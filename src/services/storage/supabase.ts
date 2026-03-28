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
  topic_id: string;
  topic_name: string;
  books: any; // JSONB
  generated_at: string;
}

interface TopicActivityRow {
  id: string;
  user_id: string;
  topic_id: string;
  topic_name: string;
  generated_at: string; // DATE
  created_at: string;
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

  // Summary operations (synced to Supabase with 7-day retention)
  async saveSummary(summary: DailySummary): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await this.client
        .from('daily_summaries')
        .upsert({
          id: summary.id,
          user_id: user.id,
          topic_id: summary.topicId,
          topic_name: summary.topicName,
          summary: summary.summary,
          generated_at: new Date(summary.generatedAt).toISOString(),
          expires_at: new Date(summary.expiresAt).toISOString(),
        });

      if (error) throw error;

      // Also save to local backend for offline access
      await this.localBackend.saveSummary(summary);
    } catch (error) {
      console.error('Error saving summary to Supabase:', error);
      // Fallback to local storage
      await this.localBackend.saveSummary(summary);
    }
  }

  async getSummaryByTopic(topicId: string): Promise<DailySummary | null> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) {
        // Not authenticated, use local backend
        return this.localBackend.getSummaryByTopic(topicId);
      }

      const { data, error } = await this.client
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .eq('topic_id', topicId)
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No summary found in cloud, check local
          return this.localBackend.getSummaryByTopic(topicId);
        }
        throw error;
      }

      if (!data) {
        return this.localBackend.getSummaryByTopic(topicId);
      }

      const summary: DailySummary = {
        id: data.id,
        topicId: data.topic_id,
        topicName: data.topic_name,
        summary: data.summary,
        generatedAt: new Date(data.generated_at).getTime(),
        expiresAt: new Date(data.expires_at).getTime(),
      };

      // Cache locally for offline access
      await this.localBackend.saveSummary(summary);

      return summary;
    } catch (error) {
      console.error('Error fetching summary from Supabase:', error);
      // Fallback to local storage
      return this.localBackend.getSummaryByTopic(topicId);
    }
  }

  async getAllSummaries(): Promise<DailySummary[]> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) {
        return this.localBackend.getAllSummaries();
      }

      const { data, error } = await this.client
        .from('daily_summaries')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        topicId: row.topic_id,
        topicName: row.topic_name,
        summary: row.summary,
        generatedAt: new Date(row.generated_at).getTime(),
        expiresAt: new Date(row.expires_at).getTime(),
      }));
    } catch (error) {
      console.error('Error fetching summaries from Supabase:', error);
      return this.localBackend.getAllSummaries();
    }
  }

  async deleteSummary(id: string): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await this.client
        .from('daily_summaries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Also delete from local backend
      await this.localBackend.deleteSummary(id);
    } catch (error) {
      console.error('Error deleting summary from Supabase:', error);
      // Still try to delete locally
      await this.localBackend.deleteSummary(id);
    }
  }

  async cleanupExpiredSummaries(): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) {
        // Not authenticated, cleanup local only
        return this.localBackend.cleanupExpiredSummaries();
      }

      // Delete expired summaries from Supabase
      const { error } = await this.client
        .from('daily_summaries')
        .delete()
        .eq('user_id', user.id)
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      // Also cleanup local backend
      await this.localBackend.cleanupExpiredSummaries();
    } catch (error) {
      console.error('Error cleaning up expired summaries from Supabase:', error);
      // Still cleanup local
      await this.localBackend.cleanupExpiredSummaries();
    }
  }

  // Topic activity operations
  async logTopicActivity(topicId: string, topicName: string): Promise<void> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const { error } = await this.client
        .from('topic_activity')
        .upsert({
          user_id: user.id,
          topic_id: topicId,
          topic_name: topicName,
          generated_at: today,
        }, {
          onConflict: 'user_id,topic_id,generated_at'
        });

      if (error) throw error;

      // Also log locally
      await this.localBackend.logTopicActivity(topicId, topicName);
    } catch (error) {
      console.error('Error logging topic activity to Supabase:', error);
      // Fallback to local
      await this.localBackend.logTopicActivity(topicId, topicName);
    }
  }

  async getActiveTopicIdsForQuarter(quarter: string): Promise<string[]> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) {
        return this.localBackend.getActiveTopicIdsForQuarter(quarter);
      }

      // Parse quarter to get date range
      const [year, q] = quarter.split('-Q');
      const quarterNum = parseInt(q);
      const startMonth = (quarterNum - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      
      const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(endMonth).padStart(2, '0')}-31`;

      const { data, error } = await this.client
        .from('topic_activity')
        .select('topic_id')
        .eq('user_id', user.id)
        .gte('generated_at', startDate)
        .lte('generated_at', endDate);

      if (error) throw error;

      // Return unique topic IDs
      const uniqueTopicIds = [...new Set((data || []).map((row: any) => row.topic_id))];
      return uniqueTopicIds;
    } catch (error) {
      console.error('Error fetching active topics from Supabase:', error);
      return this.localBackend.getActiveTopicIdsForQuarter(quarter);
    }
  }

  // Book list operations (per-topic)
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
          topic_id: bookList.topicId,
          topic_name: bookList.topicName,
          books: bookList.books,
          generated_at: new Date(bookList.generatedAt).toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving book list to Supabase:', error);
      throw error;
    }
  }

  async getBookListByQuarterAndTopic(quarter: string, topicId: string): Promise<QuarterlyBookList | null> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) return null;

      const { data, error } = await this.client
        .from('book_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('quarter', quarter)
        .eq('topic_id', topicId)
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
        topicId: row.topic_id,
        topicName: row.topic_name,
        books: row.books,
        generatedAt: new Date(row.generated_at).getTime(),
      };
    } catch (error) {
      console.error('Error fetching book list from Supabase:', error);
      throw error;
    }
  }

  async getBookListsByQuarter(quarter: string): Promise<QuarterlyBookList[]> {
    try {
      const { data: { user } } = await this.client.auth.getUser();
      if (!user) return [];

      const { data, error } = await this.client
        .from('book_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('quarter', quarter);

      if (error) throw error;

      return (data || []).map((row: BookListRow) => ({
        id: row.id,
        quarter: row.quarter,
        topicId: row.topic_id,
        topicName: row.topic_name,
        books: row.books,
        generatedAt: new Date(row.generated_at).getTime(),
      }));
    } catch (error) {
      console.error('Error fetching book lists from Supabase:', error);
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
