import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchRSSFeed, fetchMultipleFeeds } from '../rss'
import type { RSSFeedItem } from '../../types'

describe('RSS Service - Branch Coverage', () => {
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

  describe('fetchRSSFeed - Atom feed support', () => {
    it('should parse Atom feed with single entry', async () => {
      const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom Entry Title</title>
    <link href="https://example.com/atom-article"/>
    <updated>2024-03-15T10:00:00Z</updated>
    <summary>Atom summary</summary>
  </entry>
</feed>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => atomXml,
      })

      const result = await fetchRSSFeed('https://example.com/atom', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Atom Entry Title')
      expect(result[0].link).toBe('https://example.com/atom-article')
    })

    it('should parse Atom feed with multiple entries', async () => {
      const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>First Entry</title>
    <link href="https://example.com/first"/>
    <updated>2024-03-15T10:00:00Z</updated>
  </entry>
  <entry>
    <title>Second Entry</title>
    <link href="https://example.com/second"/>
    <updated>2024-03-14T10:00:00Z</updated>
  </entry>
</feed>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => atomXml,
      })

      const result = await fetchRSSFeed('https://example.com/atom', 'https://proxy.com')

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('First Entry')
      expect(result[1].title).toBe('Second Entry')
    })
  })

  describe('fetchRSSFeed - RSS feed with single item', () => {
    it('should parse RSS feed with single item', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Single RSS Item</title>
      <link>https://example.com/single</link>
      <pubDate>Fri, 15 Mar 2024 10:00:00 GMT</pubDate>
      <description>Single item description</description>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => rssXml,
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Single RSS Item')
      expect(result[0].link).toBe('https://example.com/single')
    })
  })

  describe('normalizeItem - edge cases', () => {
    it('should handle missing title', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <link>https://example.com/no-title</link>
      <pubDate>Fri, 15 Mar 2024 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => rssXml,
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Untitled')
      expect(result[0].link).toBe('https://example.com/no-title')
    })

    it('should handle missing link', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>No Link Item</title>
      <pubDate>Fri, 15 Mar 2024 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => rssXml,
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('No Link Item')
      expect(result[0].link).toBe('')
    })

    it('should handle Atom link with @_href attribute', async () => {
      const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom with href</title>
    <link href="https://example.com/href-link"/>
    <updated>2024-03-15T10:00:00Z</updated>
  </entry>
</feed>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => atomXml,
      })

      const result = await fetchRSSFeed('https://example.com/atom', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].link).toBe('https://example.com/href-link')
    })

    it('should handle missing pubDate/updated', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>No Date Item</title>
      <link>https://example.com/no-date</link>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => rssXml,
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].pubDate).toBeUndefined()
    })

    it('should handle description vs content:encoded', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title>Content Encoded Item</title>
      <link>https://example.com/content</link>
      <description>Short description</description>
      <content:encoded><![CDATA[<p>Full HTML content</p>]]></content:encoded>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => rssXml,
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].description).toBe('<p>Full HTML content</p>')
    })

    it('should fallback to description when content:encoded is missing', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Description Only</title>
      <link>https://example.com/desc</link>
      <description>Just description</description>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => rssXml,
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].description).toBe('Just description')
    })

    it('should handle Atom summary/content', async () => {
      const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom Content</title>
    <link href="https://example.com/atom-content"/>
    <updated>2024-03-15T10:00:00Z</updated>
    <content type="html">&lt;p&gt;HTML content&lt;/p&gt;</content>
    <summary>Summary text</summary>
  </entry>
</feed>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => atomXml,
      })

      const result = await fetchRSSFeed('https://example.com/atom', 'https://proxy.com')

      expect(result).toHaveLength(1)
      expect(result[0].description).toBe('<p>HTML content</p>')
    })
  })

  describe('fetchRSSFeed - error handling', () => {
    it('should throw error on failed fetch', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      })

      await expect(
        fetchRSSFeed('https://example.com/rss', 'https://proxy.com')
      ).rejects.toThrow('Failed to fetch RSS feed: Not Found')
    })

    it('should throw error on network failure', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      await expect(
        fetchRSSFeed('https://example.com/rss', 'https://proxy.com')
      ).rejects.toThrow('Network error')
    })

    it('should return empty array for malformed XML', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => 'not valid xml',
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toEqual([])
    })

    it('should return empty array for XML without items/entries', async () => {
      const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => emptyXml,
      })

      const result = await fetchRSSFeed('https://example.com/rss', 'https://proxy.com')

      expect(result).toEqual([])
    })
  })

  describe('fetchMultipleFeeds', () => {
    it('should fetch and combine multiple feeds', async () => {
      const rssXml1 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Feed 1 Item</title>
      <link>https://example.com/feed1</link>
    </item>
  </channel>
</rss>`

      const rssXml2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Feed 2 Item</title>
      <link>https://example.com/feed2</link>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any)
        .mockResolvedValueOnce({ ok: true, text: async () => rssXml1 })
        .mockResolvedValueOnce({ ok: true, text: async () => rssXml2 })

      const result = await fetchMultipleFeeds(
        ['https://feed1.com', 'https://feed2.com'],
        'https://proxy.com'
      )

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Feed 1 Item')
      expect(result[1].title).toBe('Feed 2 Item')
    })

    it('should handle partial failures gracefully', async () => {
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Success Item</title>
      <link>https://example.com/success</link>
    </item>
  </channel>
</rss>`

      ;(global.fetch as any)
        .mockResolvedValueOnce({ ok: true, text: async () => rssXml })
        .mockResolvedValueOnce({ ok: false, statusText: 'Server Error' })

      const result = await fetchMultipleFeeds(
        ['https://feed1.com', 'https://feed2.com'],
        'https://proxy.com'
      )

      // Should return items from successful feed only
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Success Item')
    })

    it('should return empty array when all feeds fail', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({ ok: false, statusText: 'Error 1' })
        .mockResolvedValueOnce({ ok: false, statusText: 'Error 2' })

      const result = await fetchMultipleFeeds(
        ['https://feed1.com', 'https://feed2.com'],
        'https://proxy.com'
      )

      expect(result).toEqual([])
    })

    it('should handle empty feed URLs array', async () => {
      const result = await fetchMultipleFeeds([], 'https://proxy.com')

      expect(result).toEqual([])
    })
  })
})
