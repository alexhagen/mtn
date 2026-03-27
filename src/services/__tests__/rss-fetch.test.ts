import { describe, it, expect } from 'vitest'
import { fetchRSSFeed, fetchMultipleFeeds, filterArticlesByDate } from '../rss'

describe('RSS Service - Network Fetching', () => {
  const proxyUrl = 'https://your-worker.workers.dev'

  describe('fetchRSSFeed', () => {
    it('should fetch and parse an RSS feed', async () => {
      const feedUrl = 'https://example.com/feed.xml'
      
      const items = await fetchRSSFeed(feedUrl, proxyUrl)
      
      expect(items).toHaveLength(1)
      expect(items[0].title).toBe('Test Article')
      expect(items[0].link).toBe('https://example.com/article')
      expect(items[0].description).toBe('Test description')
    })

    it('should handle fetch errors gracefully', async () => {
      const feedUrl = 'https://nonexistent.example.com/feed.xml'
      
      await expect(fetchRSSFeed(feedUrl, proxyUrl)).rejects.toThrow()
    })
  })

  describe('fetchMultipleFeeds', () => {
    it('should fetch multiple feeds and combine results', async () => {
      const feedUrls = [
        'https://example.com/feed1.xml',
        'https://example.com/feed2.xml',
      ]
      
      const items = await fetchMultipleFeeds(feedUrls, proxyUrl)
      
      expect(items.length).toBeGreaterThan(0)
    })

    it('should continue fetching even if one feed fails', async () => {
      const feedUrls = [
        'https://example.com/feed.xml',
        'https://nonexistent.example.com/feed.xml',
      ]
      
      const items = await fetchMultipleFeeds(feedUrls, proxyUrl)
      
      // Should still get items from the successful feed
      expect(items.length).toBeGreaterThan(0)
    })
  })

  describe('filterArticlesByDate', () => {
    it('should filter articles from the last 24 hours', () => {
      const now = Date.now()
      const articles = [
        {
          title: 'Recent',
          link: 'https://example.com/recent',
          pubDate: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
        },
        {
          title: 'Old',
          link: 'https://example.com/old',
          pubDate: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        },
      ]

      const filtered = filterArticlesByDate(articles, 24)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Recent')
    })
  })
})
