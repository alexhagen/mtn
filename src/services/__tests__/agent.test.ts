import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateDailySummary, generateBookRecommendations } from '../agent'
import type { RSSFeedItem, AgentProgress } from '../../types'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn(),
      },
    })),
  }
})

describe('Agent Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateDailySummary', () => {
    it('should generate a summary with thinking and final content', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          // Emit thinking content
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Analyzing articles...' },
          }
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' Finding themes...' },
          }
          // Emit tool use
          yield { type: 'content_block_stop' }
        },
        finalMessage: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'finalize_summary',
              input: {
                summary: '# Daily Summary\n\nThis is the final summary.',
              },
            },
          ],
          usage: {
            input_tokens: 1000,
            output_tokens: 500,
          },
        }),
      }

      const mockAnthropicInstance = new Anthropic()
      mockAnthropicInstance.messages.stream = vi.fn().mockResolvedValue(mockStream)

      const articles: RSSFeedItem[] = [
        {
          title: 'Test Article',
          link: 'https://example.com/article',
          description: 'Test description',
          pubDate: new Date().toISOString(),
        },
      ]

      const progressUpdates: AgentProgress[] = []
      const onProgress = (progress: AgentProgress) => {
        progressUpdates.push(progress)
      }

      const result = await generateDailySummary('Technology', articles, {
        apiKey: 'test-key',
        model: 'claude-opus-4-6',
      }, onProgress)

      expect(result.text).toBe('# Daily Summary\n\nThis is the final summary.')
      expect(result.cost.inputTokens).toBe(1000)
      expect(result.cost.outputTokens).toBe(500)
      expect(result.cost.model).toBe('claude-opus-4-6')
      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates.some(p => p.type === 'thinking')).toBe(true)
      expect(progressUpdates.some(p => p.type === 'final')).toBe(true)
    })

    it('should use custom prompts when provided', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_stop' }
        },
        finalMessage: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'finalize_summary',
              input: { summary: 'Custom summary' },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      }

      const mockAnthropicInstance = new Anthropic()
      mockAnthropicInstance.messages.stream = vi.fn().mockResolvedValue(mockStream)

      const articles: RSSFeedItem[] = [
        { title: 'Test', link: 'https://example.com', description: 'Test' },
      ]

      await generateDailySummary('Tech', articles, {
        apiKey: 'test-key',
        dailySummarySystemPrompt: 'Custom system prompt',
        dailySummaryUserPrompt: 'Custom user prompt for {topicName}',
      })

      expect(mockAnthropicInstance.messages.stream).toHaveBeenCalledWith(
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

  describe('generateBookRecommendations', () => {
    it('should generate book recommendations', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Researching books...' },
          }
          yield { type: 'content_block_stop' }
        },
        finalMessage: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'tool_use',
              name: 'finalize_recommendations',
              input: {
                recommendations: '# Book Recommendations\n\n1. Book Title by Author',
              },
            },
          ],
          usage: { input_tokens: 500, output_tokens: 1000 },
        }),
      }

      const mockAnthropicInstance = new Anthropic()
      mockAnthropicInstance.messages.stream = vi.fn().mockResolvedValue(mockStream)

      const topics = ['AI', 'Machine Learning']
      const progressUpdates: AgentProgress[] = []

      const result = await generateBookRecommendations(topics, {
        apiKey: 'test-key',
      }, (progress) => progressUpdates.push(progress))

      expect(result.text).toContain('Book Recommendations')
      expect(result.cost.inputTokens).toBe(500)
      expect(result.cost.outputTokens).toBe(1000)
      expect(progressUpdates.length).toBeGreaterThan(0)
    })
  })
})
