import Anthropic from '@anthropic-ai/sdk';
import type { RSSFeedItem, AgentProgress, CostEstimate } from '../types';

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

function calculateCost(inputTokens: number, outputTokens: number, model: string): CostEstimate {
  const pricing = MODEL_PRICING[model] || { input: 3, output: 15 }; // Default to Sonnet pricing
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  
  return {
    inputTokens,
    outputTokens,
    model,
    estimatedCost: cost,
  };
}

export async function generateDailySummary(
  topicName: string,
  articles: RSSFeedItem[],
  config: AgentConfig,
  onProgress?: (progress: AgentProgress) => void
): Promise<{ text: string; cost: CostEstimate }> {
  const anthropic = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true, // Required for browser usage
  });

  const articlesText = articles
    .map((article, idx) => {
      return `Article ${idx + 1}:
Title: ${article.title}
URL: ${article.link}
Description: ${article.description || 'N/A'}
---`;
    })
    .join('\n\n');

  const systemPrompt = config.dailySummarySystemPrompt || DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT;

  const userPromptTemplate = config.dailySummaryUserPrompt || DEFAULT_DAILY_SUMMARY_USER_PROMPT;
  const userPrompt = userPromptTemplate
    .replace('{topicName}', topicName)
    .replace('{articles}', articlesText);

  const tools: Anthropic.Tool[] = [
    {
      name: 'finalize_summary',
      description: 'Call this tool when you are ready to provide the final summary. This signals that your analysis is complete.',
      input_schema: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'The final markdown-formatted summary of the daily news',
          },
        },
        required: ['summary'],
      },
    },
  ];

  let finalSummary = '';
  let thinkingContent = '';

  const stream = await anthropic.messages.stream({
    model: config.model || 'claude-opus-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    tools,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        thinkingContent += event.delta.text;
        onProgress?.({
          type: 'thinking',
          content: thinkingContent,
        });
      }
    } else if (event.type === 'content_block_stop') {
      // Check if this was a tool use block
      const message = await stream.finalMessage();
      const toolUse = message.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUse && toolUse.name === 'finalize_summary') {
        const input = toolUse.input as { summary: string };
        finalSummary = input.summary;
        
        // Stream the final summary
        onProgress?.({
          type: 'final',
          content: finalSummary,
        });
      }
    }
  }

  const finalMessage = await stream.finalMessage();
  const usage = finalMessage.usage;
  const cost = calculateCost(usage.input_tokens, usage.output_tokens, config.model || 'claude-opus-4-6');

  return {
    text: finalSummary || thinkingContent,
    cost,
  };
}

export interface BookRecommendationContext {
  bookmarkedArticles?: {
    title: string;
    wordCount: number;
  }[];
}

export async function generateBookRecommendations(
  topicName: string,
  config: AgentConfig,
  context?: BookRecommendationContext,
  onProgress?: (progress: AgentProgress) => void
): Promise<{ text: string; cost: CostEstimate }> {
  const anthropic = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const systemPrompt = config.bookRecommendationsSystemPrompt || DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT;

  // Build context section
  let contextSection = '';
  if (context?.bookmarkedArticles && context.bookmarkedArticles.length > 0) {
    const longFormArticles = context.bookmarkedArticles.filter(a => a.wordCount >= 1500);
    if (longFormArticles.length > 0) {
      contextSection = `The reader has recently bookmarked these long-form articles for deep reading, suggesting particular interest in these angles:\n\n`;
      longFormArticles.forEach(article => {
        contextSection += `- ${article.title} (${article.wordCount.toLocaleString()} words)\n`;
      });
      contextSection += `\nGive a light preference to books that connect with these interests.\n`;
    }
  }

  const userPromptTemplate = config.bookRecommendationsUserPrompt || DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT;
  const userPrompt = userPromptTemplate
    .replace('{topicName}', topicName)
    .replace('{contextSection}', contextSection);

  const tools: Anthropic.Tool[] = [
    {
      name: 'finalize_recommendations',
      description: 'Call this tool when you are ready to provide the final book recommendations.',
      input_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'string',
            description: 'The final markdown-formatted book recommendations',
          },
        },
        required: ['recommendations'],
      },
    },
  ];

  let finalRecommendations = '';
  let thinkingContent = '';

  const stream = await anthropic.messages.stream({
    model: config.model || 'claude-opus-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    tools,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        thinkingContent += event.delta.text;
        onProgress?.({
          type: 'thinking',
          content: thinkingContent,
        });
      }
    } else if (event.type === 'content_block_stop') {
      const message = await stream.finalMessage();
      const toolUse = message.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUse && toolUse.name === 'finalize_recommendations') {
        const input = toolUse.input as { recommendations: string };
        finalRecommendations = input.recommendations;
        
        onProgress?.({
          type: 'final',
          content: finalRecommendations,
        });
      }
    }
  }

  const finalMessage = await stream.finalMessage();
  const usage = finalMessage.usage;
  const cost = calculateCost(usage.input_tokens, usage.output_tokens, config.model || 'claude-opus-4-6');

  return {
    text: finalRecommendations || thinkingContent,
    cost,
  };
}
