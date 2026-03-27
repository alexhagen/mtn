import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GenerationPipeline } from '../generation-pipeline'
import type { RSSFeedItem } from '../../types'
import type Anthropic from '@anthropic-ai/sdk'

// Helper to create a mock Anthropic client
function createMockAnthropic(toolName: string, toolOutput: any, thinkingText = 'Analyzing...') {
  const mockStream = {
    async *[Symbol.asyncIterator]() {
      // Emit thinking content
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: thinkingText },
      }
      // Emit tool use
      yield { type: 'content_block_stop' }
    },
    finalMessage: vi.fn().mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: toolName,
          input: toolOutput,
        },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
    }),
  }

  return {
    messages: {
      stream: vi.fn().mockResolvedValue(mockStream),
    },
  } as unknown as Anthropic
}

// Helper to create a mock Anthropic client that doesn't call the tool
function createMockAnthropicWithoutTool(thinkingText = 'Analyzing...') {
  const mockStream = {
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: thinkingText },
      }
      yield { type: 'content_block_stop' }
    },
    finalMessage: vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: thinkingText,
        },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
      },
    }),
  }

  return {
    messages: {
      stream: vi.fn().mockResolvedValue(mockStream),
    },
  } as unknown as Anthropic
}

describe('GenerationPipeline', () => {
  const mockArticles: RSSFeedItem[] = [
    {
      title: 'Test Article 1',
      link: 'https://example.com/article1',
      description: 'Test description 1',
      pubDate: new Date().toISOString(),
    },
    {
      title: 'Test Article 2',
      link: 'https://example.com/article2',
      description: 'Test description 2',
      pubDate: new Date().toISOString(),
    },
  ]

  describe('generate - daily summary', () => {
    it('should generate a summary with valid articles and return structured result', async () => {
      const mockAnthropic = createMockAnthropic('finalize_summary', {
        summary: '# Daily Summary\n\nThis is the final summary with [links](https://example.com).',
      })

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
        model: 'claude-opus-4-6',
      })

      const result = await pipeline.generate({
        type: 'daily-summary',
        topicName: 'Technology',
        articles: mockArticles,
      })

      expect(result.content).toBe('# Daily Summary\n\nThis is the final summary with [links](https://example.com).')
      expect(result.cost.inputTokens).toBe(1000)
      expect(result.cost.outputTokens).toBe(500)
      expect(result.cost.model).toBe('claude-opus-4-6')
      expect(result.cost.estimatedCost).toBeGreaterThan(0)
      expect(result.metadata.generatedAt).toBeGreaterThan(0)
      expect(result.metadata.model).toBe('claude-opus-4-6')
    })

    it('should call progress callback during streaming', async () => {
      const mockAnthropic = createMockAnthropic('finalize_summary', {
        summary: 'Final summary',
      }, 'Thinking step 1... Thinking step 2...')

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
      })

      const progressUpdates: Array<{ type: string; content: string }> = []
      const onProgress = vi.fn((progress) => {
        progressUpdates.push(progress)
      })

      await pipeline.generate({
        type: 'daily-summary',
        topicName: 'AI',
        articles: mockArticles,
        onProgress,
      })

      expect(onProgress).toHaveBeenCalled()
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates.some(p => p.type === 'thinking')).toBe(true)
      expect(progressUpdates.some(p => p.type === 'final')).toBe(true)
      expect(progressUpdates.find(p => p.type === 'final')?.content).toBe('Final summary')
    })

    it('should use custom prompts when provided', async () => {
      const mockAnthropic = createMockAnthropic('finalize_summary', {
        summary: 'Custom summary',
      })

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
        dailySummarySystemPrompt: 'Custom system prompt',
        dailySummaryUserPrompt: 'Custom user prompt for {topicName}',
      })

      await pipeline.generate({
        type: 'daily-summary',
        topicName: 'Tech',
        articles: mockArticles,
      })

      expect(mockAnthropic.messages.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Custom system prompt',
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Custom user prompt for Tech'),
            }),
          ]),
        })
      )
    })
  })

  describe('generate - book recommendations', () => {
    it('should generate book recommendations and return structured books', async () => {
      const mockMarkdown = `Here are my recommendations:

**The Innovators** by Walter Isaacson
A comprehensive history of the digital revolution and the people who made it happen.
Purchase links: [Amazon](https://amazon.com/innovators) | [Bookshop](https://bookshop.org/innovators)

**Thinking, Fast and Slow** by Daniel Kahneman
An exploration of the two systems that drive the way we think.
Purchase links: [Amazon](https://amazon.com/thinking) | [Bookshop](https://bookshop.org/thinking)`

      const mockAnthropic = createMockAnthropic('finalize_recommendations', {
        recommendations: mockMarkdown,
      })

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
      })

      const result = await pipeline.generate({
        type: 'book-recommendations',
        topics: ['AI', 'Psychology'],
      })

      expect(result.content).toBe(mockMarkdown)
      expect(result.books).toBeDefined()
      expect(result.books?.length).toBe(2)
      
      const firstBook = result.books![0]
      expect(firstBook.title).toBe('The Innovators')
      expect(firstBook.author).toBe('Walter Isaacson')
      expect(firstBook.description).toContain('comprehensive history')
      expect(firstBook.purchaseLinks.amazon).toBe('https://amazon.com/innovators')
      expect(firstBook.purchaseLinks.bookshop).toBe('https://bookshop.org/innovators')
      expect(firstBook.isRead).toBe(false)

      const secondBook = result.books![1]
      expect(secondBook.title).toBe('Thinking, Fast and Slow')
      expect(secondBook.author).toBe('Daniel Kahneman')
    })

    it('should call progress callback during book generation', async () => {
      const mockAnthropic = createMockAnthropic('finalize_recommendations', {
        recommendations: '**Book** by Author\nDescription',
      })

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
      })

      const progressUpdates: Array<{ type: string; content: string }> = []
      
      await pipeline.generate({
        type: 'book-recommendations',
        topics: ['Science'],
        onProgress: (progress) => progressUpdates.push(progress),
      })

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates.some(p => p.type === 'thinking')).toBe(true)
      expect(progressUpdates.some(p => p.type === 'final')).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should throw error when tool use is missing', async () => {
      const mockAnthropic = createMockAnthropicWithoutTool('Just thinking, no tool call')

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
      })

      await expect(
        pipeline.generate({
          type: 'daily-summary',
          topicName: 'Tech',
          articles: mockArticles,
        })
      ).rejects.toThrow('Model failed to call the finalize_summary tool')
    })

    it('should throw error when wrong tool is called', async () => {
      const mockAnthropic = createMockAnthropic('wrong_tool_name', {
        summary: 'Wrong tool',
      })

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
      })

      await expect(
        pipeline.generate({
          type: 'daily-summary',
          topicName: 'Tech',
          articles: mockArticles,
        })
      ).rejects.toThrow('Model failed to call the finalize_summary tool')
    })
  })

  describe('cost calculation', () => {
    it('should calculate correct cost for different models', async () => {
      const testCases = [
        { model: 'claude-opus-4-6', expectedMin: 0.05, expectedMax: 0.10 },
        { model: 'claude-sonnet-4-20250514', expectedMin: 0.01, expectedMax: 0.02 },
        { model: 'claude-haiku-3-5-20241022', expectedMin: 0.002, expectedMax: 0.006 },
      ]

      for (const { model, expectedMin, expectedMax } of testCases) {
        const mockAnthropic = createMockAnthropic('finalize_summary', {
          summary: 'Test summary',
        })

        const pipeline = new GenerationPipeline(mockAnthropic, {
          apiKey: 'test-key',
          model,
        })

        const result = await pipeline.generate({
          type: 'daily-summary',
          topicName: 'Tech',
          articles: mockArticles,
        })

        expect(result.cost.model).toBe(model)
        expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(expectedMin)
        expect(result.cost.estimatedCost).toBeLessThanOrEqual(expectedMax)
      }
    })

    it('should use default pricing for unknown models', async () => {
      const mockAnthropic = createMockAnthropic('finalize_summary', {
        summary: 'Test',
      })

      const pipeline = new GenerationPipeline(mockAnthropic, {
        apiKey: 'test-key',
        model: 'unknown-model',
      })

      const result = await pipeline.generate({
        type: 'daily-summary',
        topicName: 'Tech',
        articles: mockArticles,
      })

      // Should default to Sonnet pricing
      expect(result.cost.estimatedCost).toBeGreaterThan(0)
      expect(result.cost.model).toBe('unknown-model')
    })
  })
})
