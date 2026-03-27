import Anthropic from '@anthropic-ai/sdk';
import type { RSSFeedItem, AgentProgress, CostEstimate } from '../types';
import { createPipeline } from './generation-pipeline';

export interface AgentConfig {
  apiKey: string;
  model?: string;
  dailySummarySystemPrompt?: string;
  dailySummaryUserPrompt?: string;
  bookRecommendationsSystemPrompt?: string;
  bookRecommendationsUserPrompt?: string;
}

// Default prompts
export const DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT = `You are a news analyst tasked with creating a comprehensive daily news summary. Your goal is to:

1. Identify major themes that appear across multiple sources
2. Write a rich, engaging summary in paragraph form
3. Include links to source articles using markdown format
4. Note where sources agree or disagree on key points
5. Focus on the most significant stories

The summary should be well-structured with clear sections for different themes.`;

export const DEFAULT_DAILY_SUMMARY_USER_PROMPT = `Topic: {topicName}

Here are the articles from the past 24 hours:

{articles}

Please analyze these articles and create a comprehensive daily news summary. Identify the major themes that appear across multiple sources, and write your summary in rich markdown format with proper headings, paragraphs, and links.

When you're ready to provide the final summary, use the finalize_summary tool.`;

export const DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT = `You are a book recommendation expert. Your task is to research and recommend both popular and scholarly books related to given topics. For each book, provide:

1. Title and author
2. Brief description (2-3 sentences)
3. Why it's relevant to the topic
4. Purchase links (Amazon and Bookshop.org if available)

Format your response as a markdown list with proper structure.`;

export const DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT = `Topic: {topicName}

{contextSection}

Please recommend 5-8 books specifically about {topicName} that are:
- Mix of popular and scholarly works
- Recently published or highly relevant classics
- Diverse perspectives on the topic

Format each recommendation with:
- **Title** by Author
- Description
- Purchase links: [Amazon](url) | [Bookshop](url)

When ready, use the finalize_recommendations tool.`;

// Model pricing (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
};

/**
 * @deprecated Use createPipeline().generate() instead
 * This function is kept for backward compatibility
 */
export async function generateDailySummary(
  topicName: string,
  articles: RSSFeedItem[],
  config: AgentConfig,
  onProgress?: (progress: AgentProgress) => void
): Promise<{ text: string; cost: CostEstimate }> {
  const pipeline = createPipeline(config.apiKey, {
    model: config.model,
    dailySummarySystemPrompt: config.dailySummarySystemPrompt,
    dailySummaryUserPrompt: config.dailySummaryUserPrompt,
  });

  const result = await pipeline.generate({
    type: 'daily-summary',
    topicName,
    articles,
    onProgress,
  });

  return {
    text: result.content,
    cost: result.cost,
  };
}

export interface BookRecommendationContext {
  bookmarkedArticles?: {
    title: string;
    wordCount: number;
  }[];
}

/**
 * @deprecated Use createPipeline().generate() instead
 * This function is kept for backward compatibility
 * Note: The signature expects topicName (string) but Books.tsx passes topics (string[])
 */
export async function generateBookRecommendations(
  topicName: string | string[],
  config: AgentConfig,
  context?: BookRecommendationContext | ((progress: AgentProgress) => void),
  onProgress?: (progress: AgentProgress) => void
): Promise<{ text: string; cost: CostEstimate }> {
  // Handle overloaded signature from Books.tsx
  const topics = Array.isArray(topicName) ? topicName : [topicName];
  const actualOnProgress = typeof context === 'function' ? context : onProgress;

  const pipeline = createPipeline(config.apiKey, {
    model: config.model,
    bookRecommendationsSystemPrompt: config.bookRecommendationsSystemPrompt,
    bookRecommendationsUserPrompt: config.bookRecommendationsUserPrompt,
  });

  const result = await pipeline.generate({
    type: 'book-recommendations',
    topics,
    onProgress: actualOnProgress,
  });

  return {
    text: result.content,
    cost: result.cost,
  };
}
