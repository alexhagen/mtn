import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchArticleContent } from '../readability'

describe('Readability Service - Branch Coverage', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    // Save original fetch and replace with mock
    originalFetch = global.fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch
  })

  describe('fetchArticleContent - error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result).toEqual({
        content: '',
        wordCount: 0,
      })
    })

    it('should handle non-OK response', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result).toEqual({
        content: '',
        wordCount: 0,
      })
    })

    it('should handle empty response body', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result).toEqual({
        content: '',
        wordCount: 0,
      })
    })

    it('should handle malformed HTML', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => 'not valid html at all',
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      // Should still attempt to parse and return something
      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.wordCount).toBeDefined()
    })
  })

  describe('fetchArticleContent - content extraction', () => {
    it('should extract content from article with main content', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Article</title></head>
          <body>
            <article>
              <h1>Article Title</h1>
              <p>This is the main content of the article.</p>
              <p>It has multiple paragraphs.</p>
            </article>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result.content).toContain('Article Title')
      expect(result.content).toContain('main content')
      expect(result.wordCount).toBeGreaterThan(0)
    })

    it('should handle article with no paragraphs', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <div>Just some text without paragraphs</div>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
    })

    it('should fallback when no article tag exists', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <div class="content">
              <p>Content in a div instead of article tag.</p>
            </div>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
    })

    it('should calculate word count correctly', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>One two three four five six seven eight nine ten.</p>
            </article>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result.wordCount).toBe(10)
    })

    it('should handle content with extra whitespace', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Word1    word2     word3</p>
            </article>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result.wordCount).toBe(3)
    })

    it('should strip HTML tags from content', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>Text with <strong>bold</strong> and <em>italic</em> tags.</p>
            </article>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result.content).not.toContain('<strong>')
      expect(result.content).not.toContain('<em>')
      expect(result.content).toContain('bold')
      expect(result.content).toContain('italic')
    })

    it('should handle empty article tag', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article></article>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result.content).toBe('')
      expect(result.wordCount).toBe(0)
    })

    it('should handle article with only whitespace', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <p>   </p>
              <p>
              
              </p>
            </article>
          </body>
        </html>
      `

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      const result = await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(result.content.trim()).toBe('')
      expect(result.wordCount).toBe(0)
    })
  })

  describe('fetchArticleContent - proxy usage', () => {
    it('should send correct request to proxy', async () => {
      const html = '<html><body><article><p>Test</p></article></body></html>'

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => html,
      })

      await fetchArticleContent('https://example.com/article', 'https://proxy.com')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://proxy.com',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: 'https://example.com/article',
            method: 'GET',
          }),
        })
      )
    })
  })
})
