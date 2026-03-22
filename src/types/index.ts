// Core types for the application

export interface Topic {
  id: string;
  name: string;
  rssFeeds: string[];
}

export interface Settings {
  anthropicApiKey: string;
  corsProxyUrl: string;
  topics: Topic[];
  dailySummarySystemPrompt?: string;
  dailySummaryUserPrompt?: string;
  bookRecommendationsSystemPrompt?: string;
  bookRecommendationsUserPrompt?: string;
}

export interface Article {
  id: string;
  title: string;
  url: string;
  content: string;
  wordCount: number;
  savedAt: number;
  monthKey: string; // Format: YYYY-MM
  topicId?: string; // Optional: which topic this article is associated with
}

export interface DailySummary {
  id: string;
  topicId: string;
  topicName: string;
  summary: string;
  generatedAt: number;
  expiresAt: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  purchaseLinks: {
    amazon?: string;
    bookshop?: string;
  };
  isRead: boolean;
}

export interface QuarterlyBookList {
  id: string;
  quarter: string; // Format: YYYY-Q1, YYYY-Q2, etc.
  books: Book[];
  generatedAt: number;
}

// Agent-related types
export interface AgentProgress {
  type: 'thinking' | 'final';
  content: string;
}

export interface RSSFeedItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  content?: string;
}
