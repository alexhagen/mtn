import { describe, it, expect, vi } from 'vitest'
import { extractArticleContent, countWords, isLongForm } from '../readability'

describe('Readability Service', () => {
  const proxyUrl = 'https://your-worker.workers.dev'

  describe('extractArticleContent', () => {
    it('should extract article content from HTML', async () => {
      const url = 'https://example.com/article'
      
      const result = await extractArticleContent(url, proxyUrl)
      
      expect(result.title).toBe('Test Article')
      expect(result.content).toContain('test content')
      expect(result.textContent).toContain('test content')
    })

    it('should handle extraction errors', async () => {
      const url = 'https://nonexistent.example.com/article'
      
      await expect(extractArticleContent(url, proxyUrl)).rejects.toThrow()
    })
  })

  describe('countWords', () => {
    it('should count words in plain text', () => {
      const text = 'This is a simple test'
      expect(countWords(text)).toBe(5)
    })

    it('should count words with HTML tags removed', () => {
      const html = '<p>This is <strong>bold</strong> text</p>'
      expect(countWords(html)).toBe(4)
    })

    it('should handle multiple spaces', () => {
      const text = 'This   has    multiple     spaces'
      expect(countWords(text)).toBe(4)
    })

    it('should handle empty string', () => {
      expect(countWords('')).toBe(0)
    })

    it('should handle only whitespace', () => {
      expect(countWords('   \n  \t  ')).toBe(0)
    })
  })

  describe('isLongForm', () => {
    it('should return true for articles over 4000 words', () => {
      expect(isLongForm(4001)).toBe(true)
      expect(isLongForm(5000)).toBe(true)
    })

    it('should return false for articles under 4000 words', () => {
      expect(isLongForm(3999)).toBe(false)
      expect(isLongForm(2000)).toBe(false)
    })

    it('should return false for exactly 4000 words', () => {
      expect(isLongForm(4000)).toBe(false)
    })
  })
})
