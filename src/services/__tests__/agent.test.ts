import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateDailySummary, generateBookRecommendations } from '../agent'
import type { RSSFeedItem, AgentProgress } from '../../types'

// Mock the generation pipeline
vi.mock('../generation-pipeline', () => {
  return {
    createPipeline: vi.fn(() => ({
      generate: vi.fn(),
    })),
  }
})

describe('Agent Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateDailySummary', () => {
    it('should generate a summary with thinking and final content', async () => {
      const { createPipeline } = await import('../generation-pipeline')
      const mockPipeline = {
        generate: vi.fn().mockResolvedValue({
          content: '# Daily Summary\n\nThis is the final summary.',
          cost: {
            inputTokens: 1000,
            outputTokens: 500,
            model: 'claude-opus-4-6',
            estimatedCost: 0.0525,
          },
          metadata: { generatedAt: Date.now(), model: 'claude-opus-4-6' },
        }),
      }
      
      vi.mocked(createPipeline).mockReturnValue(mockPipeline as any)

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
      expect(createPipeline).toHaveBeenCalledWith('test-key', expect.objectContaining({
        model: 'claude-opus-4-6',
      }))
    })

    it('should use custom prompts when provided', async () => {
      const { createPipeline } = await import('../generation-pipeline')
      const mockPipeline = {
        generate: vi.fn().mockResolvedValue({
          content: 'Custom summary',
          cost: {
            inputTokens: 100,
            outputTokens: 50,
            model: 'claude-opus-4-6',
            estimatedCost: 0.00525,
          },
          metadata: { generatedAt: Date.now(), model: 'claude-opus-4-6' },
        }),
      }
      
      vi.mocked(createPipeline).mockReturnValue(mockPipeline as any)

      const articles: RSSFeedItem[] = [
        { title: 'Test', link: 'https://example.com', description: 'Test' },
      ]

      await generateDailySummary('Tech', articles, {
        apiKey: 'test-key',
        dailySummarySystemPrompt: 'Custom system prompt',
        dailySummaryUserPrompt: 'Custom user prompt for {topicName}',
      })

      expect(createPipeline).toHaveBeenCalledWith('test-key', expect.objectContaining({
        dailySummarySystemPrompt: 'Custom system prompt',
        dailySummaryUserPrompt: 'Custom user prompt for {topicName}',
      }))
    })
  })

  describe('generateBookRecommendations', () => {
    it('should generate book recommendations', async () => {
      const { createPipeline } = await import('../generation-pipeline')
      const mockPipeline = {
        generate: vi.fn().mockResolvedValue({
          content: '# Book Recommendations\n\n1. Book Title by Author',
          cost: {
            inputTokens: 500,
            outputTokens: 1000,
            model: 'claude-opus-4-6',
            estimatedCost: 0.0225,
          },
          metadata: { generatedAt: Date.now(), model: 'claude-opus-4-6' },
        }),
      }
      
      vi.mocked(createPipeline).mockReturnValue(mockPipeline as any)

      const topics = ['AI', 'Machine Learning']
      const progressUpdates: AgentProgress[] = []

      const result = await generateBookRecommendations(topics, {
        apiKey: 'test-key',
      }, (progress) => progressUpdates.push(progress))

      expect(result.text).toContain('Book Recommendations')
      expect(result.cost.inputTokens).toBe(500)
      expect(result.cost.outputTokens).toBe(1000)
      expect(createPipeline).toHaveBeenCalledWith('test-key', expect.any(Object))
    })
  })
})
