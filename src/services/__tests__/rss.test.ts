import { describe, it, expect } from 'vitest'
import { filterArticlesByDate } from '../rss'
import type { RSSFeedItem } from '../../types'

describe('RSS Service', () => {
  describe('filterArticlesByDate', () => {
    it('should filter articles from the last 24 hours', () => {
      const now = Date.now()
      const articles: RSSFeedItem[] = [
        {
          title: 'Recent Article',
          link: 'https://example.com/recent',
          pubDate: new Date(now - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        },
        {
          title: 'Old Article',
          link: 'https://example.com/old',
          pubDate: new Date(now - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
        },
      ]

      const filtered = filterArticlesByDate(articles, 24)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Recent Article')
    })

    it('should filter articles with custom hours', () => {
      const now = Date.now()
      const articles: RSSFeedItem[] = [
        {
          title: 'Article 1',
          link: 'https://example.com/1',
          pubDate: new Date(now - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        },
        {
          title: 'Article 2',
          link: 'https://example.com/2',
          pubDate: new Date(now - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
        },
      ]

      const filtered = filterArticlesByDate(articles, 12)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Article 1')
    })

    it('should include articles without pubDate', () => {
      const articles: RSSFeedItem[] = [
        {
          title: 'No Date Article',
          link: 'https://example.com/nodate',
        },
      ]

      const filtered = filterArticlesByDate(articles, 24)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('No Date Article')
    })

    it('should include articles with invalid dates', () => {
      const articles: RSSFeedItem[] = [
        {
          title: 'Invalid Date Article',
          link: 'https://example.com/invalid',
          pubDate: 'not-a-valid-date',
        },
      ]

      const filtered = filterArticlesByDate(articles, 24)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Invalid Date Article')
    })

    it('should return empty array for empty input', () => {
      const filtered = filterArticlesByDate([], 24)
      expect(filtered).toHaveLength(0)
    })
  })
})
