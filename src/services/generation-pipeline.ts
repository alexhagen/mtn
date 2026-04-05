import Anthropic from '@anthropic-ai/sdk';
import type { RSSFeedItem, AgentProgress, CostEstimate, Book } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface PipelineConfig {
  apiKey: string;
  model?: string;
  dailySummarySystemPrompt?: string;
  dailySummaryUserPrompt?: string;
  bookRecommendationsSystemPrompt?: string;
  bookRecommendationsUserPrompt?: string;
}

export type GenerationRequest = 
  | DailySummaryRequest 
  | BookRecommendationsRequest;

export interface DailySummaryRequest {
  type: 'daily-summary';
  topicName: string;
  articles: RSSFeedItem[];
  onProgress?: ProgressCallback;
}

export interface BookRecommendationsRequest {
  type: 'book-recommendations';
  topics: string[];
  onProgress?: ProgressCallback;
}

export interface GenerationResult {
  content: string;
  cost: CostEstimate;
  metadata: {
    generatedAt: number;
    model: string;
  };
  books?: Book[]; // Only present for book-recommendations
}

export type ProgressCallback = (progress: AgentProgress) => void;

// ============================================================================
// Default Prompts
// ============================================================================

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

export const DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT = `Topics: {topics}

Please recommend 5-8 books specifically about these topics that are:
- Mix of popular and scholarly works
- Recently published or highly relevant classics
- Diverse perspectives on the topics

Format each recommendation with:
- **Title** by Author
- Description
- Purchase links: [Amazon](url) | [Bookshop](url)

When ready, use the finalize_recommendations tool.`;

// ============================================================================
// Model Pricing (per million tokens)
// ============================================================================

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
};

// ============================================================================
// GenerationPipeline Class
// ============================================================================

export class GenerationPipeline {
  constructor(
    private anthropic: Anthropic,
    private config: PipelineConfig
  ) {}

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (request.type === 'daily-summary') {
      return this.generateDailySummary(request);
    } else {
      return this.generateBookRecommendations(request);
    }
  }

  // --------------------------------------------------------------------------
  // Daily Summary Generation
  // --------------------------------------------------------------------------

  private async generateDailySummary(
    request: DailySummaryRequest
  ): Promise<GenerationResult> {
    const { topicName, articles, onProgress } = request;

    const articlesText = articles
      .map((article, idx) => {
        return `Article ${idx + 1}:
Title: ${article.title}
URL: ${article.link}
Description: ${article.description || 'N/A'}
---`;
      })
      .join('\n\n');

    const systemPrompt = this.config.dailySummarySystemPrompt || DEFAULT_DAILY_SUMMARY_SYSTEM_PROMPT;
    const userPromptTemplate = this.config.dailySummaryUserPrompt || DEFAULT_DAILY_SUMMARY_USER_PROMPT;
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

    const result = await this.streamAndExtractTool(
      systemPrompt,
      userPrompt,
      tools,
      'finalize_summary',
      onProgress
    );

    return {
      content: result.content,
      cost: result.cost,
      metadata: {
        generatedAt: Date.now(),
        model: this.config.model || 'claude-opus-4-6',
      },
    };
  }

  // --------------------------------------------------------------------------
  // Book Recommendations Generation
  // --------------------------------------------------------------------------

  private async generateBookRecommendations(
    request: BookRecommendationsRequest
  ): Promise<GenerationResult> {
    const { topics, onProgress } = request;

    const systemPrompt = this.config.bookRecommendationsSystemPrompt || DEFAULT_BOOK_RECOMMENDATIONS_SYSTEM_PROMPT;
    const userPromptTemplate = this.config.bookRecommendationsUserPrompt || DEFAULT_BOOK_RECOMMENDATIONS_USER_PROMPT;
    const userPrompt = userPromptTemplate.replace('{topics}', topics.join(', '));

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

    const result = await this.streamAndExtractTool(
      systemPrompt,
      userPrompt,
      tools,
      'finalize_recommendations',
      onProgress
    );

    // Parse the markdown into structured books
    const books = this.parseBookRecommendations(result.content);

    return {
      content: result.content,
      cost: result.cost,
      metadata: {
        generatedAt: Date.now(),
        model: this.config.model || 'claude-opus-4-6',
      },
      books,
    };
  }

  // --------------------------------------------------------------------------
  // Unified Streaming & Tool Extraction
  // --------------------------------------------------------------------------

  private async streamAndExtractTool(
    systemPrompt: string,
    userPrompt: string,
    tools: Anthropic.Tool[],
    expectedToolName: string,
    onProgress?: ProgressCallback
  ): Promise<{ content: string; cost: CostEstimate }> {
    let thinkingContent = '';
    let finalContent = '';

    const stream = await this.anthropic.messages.stream({
      model: this.config.model || 'claude-opus-4-6',
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

    // Stream events
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
          (block): block is Anthropic.ToolUseBlock => 
            block.type === 'tool_use' && block.name === expectedToolName
        );

        if (toolUse) {
          // Extract the content from the tool input
          const input = toolUse.input as Record<string, any>;
          finalContent = input.summary || input.recommendations || '';
          
          // Stream the final content
          onProgress?.({
            type: 'final',
            content: finalContent,
          });
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    const usage = finalMessage.usage;
    const cost = this.calculateCost(usage.input_tokens, usage.output_tokens);

    // Enforce the invariant: tool must be called
    if (!finalContent) {
      throw new Error(`Model failed to call the ${expectedToolName} tool`);
    }

    return {
      content: finalContent,
      cost,
    };
  }

  // --------------------------------------------------------------------------
  // Book Parsing (extracted from Books.tsx)
  // --------------------------------------------------------------------------

  private parseBookRecommendations(markdown: string): Book[] {
    const books: Book[] = [];
    const lines = markdown.split('\n');
    
    let currentBook: Partial<Book> | null = null;
    let description = '';

    for (const line of lines) {
      const titleMatch = line.match(/\*\*(.+?)\*\*\s+by\s+(.+)/);
      
      if (titleMatch) {
        // Save previous book if exists
        if (currentBook && currentBook.title) {
          books.push({
            id: `${Date.now()}-${Math.random()}`,
            title: currentBook.title,
            author: currentBook.author || '',
            description: description.trim(),
            purchaseLinks: currentBook.purchaseLinks || {},
            isRead: false,
          });
        }

        // Start new book
        currentBook = {
          title: titleMatch[1],
          author: titleMatch[2],
          purchaseLinks: {},
        };
        description = '';
      } else if (currentBook && (line.includes('[Amazon]') || line.includes('[Bookshop]'))) {
        const amazonMatch = line.match(/\[Amazon\]\((.+?)\)/);
        if (amazonMatch && currentBook.purchaseLinks) {
          currentBook.purchaseLinks.amazon = amazonMatch[1];
        }
        const bookshopMatch = line.match(/\[Bookshop\]\((.+?)\)/);
        if (bookshopMatch && currentBook.purchaseLinks) {
          currentBook.purchaseLinks.bookshop = bookshopMatch[1];
        }
      } else if (currentBook && line.trim() && !line.includes('[Amazon]') && !line.includes('[Bookshop]')) {
        description += line + ' ';
      }
    }

    // Save last book
    if (currentBook && currentBook.title) {
      books.push({
        id: `${Date.now()}-${Math.random()}`,
        title: currentBook.title,
        author: currentBook.author || '',
        description: description.trim(),
        purchaseLinks: currentBook.purchaseLinks || {},
        isRead: false,
      });
    }

    return books;
  }

  // --------------------------------------------------------------------------
  // Cost Calculation
  // --------------------------------------------------------------------------

  private calculateCost(inputTokens: number, outputTokens: number): CostEstimate {
    const model = this.config.model || 'claude-opus-4-6';
    const pricing = MODEL_PRICING[model] || { input: 3, output: 15 }; // Default to Sonnet pricing
    const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
    
    return {
      inputTokens,
      outputTokens,
      model,
      estimatedCost: cost,
    };
  }
}

// ============================================================================
// Convenience Factory Function
// ============================================================================

export function createPipeline(apiKey: string, config?: Partial<PipelineConfig>): GenerationPipeline {
  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for browser usage
  });

  return new GenerationPipeline(anthropic, {
    apiKey,
    ...config,
  });
}
