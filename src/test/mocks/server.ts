// MSW server for mocking network requests in tests
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Define request handlers
export const handlers = [
  // CORS proxy - RSS feed fetching
  http.post('https://your-worker.workers.dev', async ({ request }) => {
    const body = await request.json() as { url: string; method: string }
    
    // Return error for nonexistent domains
    if (body.url.includes('nonexistent')) {
      return HttpResponse.text('Not found', { status: 500 })
    }
    
    // Mock RSS feed response
    if (body.url.includes('rss') || body.url.includes('feed')) {
      return HttpResponse.text(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Article</title>
      <link>https://example.com/article</link>
      <description>Test description</description>
      <pubDate>Thu, 27 Mar 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`)
    }
    
    // Mock article HTML response
    if (body.url.includes('example.com/article')) {
      return HttpResponse.text(`<!DOCTYPE html>
<html>
  <head><title>Test Article</title></head>
  <body>
    <article>
      <h1>Test Article</h1>
      <p>This is test content for readability extraction.</p>
    </article>
  </body>
</html>`)
    }
    
    return HttpResponse.text('Not found', { status: 404 })
  }),

  // Supabase REST API - user_settings
  http.get('https://*.supabase.co/rest/v1/user_settings', () => {
    return HttpResponse.json([
      {
        user_id: 'test-user-id',
        anthropic_api_key_encrypted: 'encrypted-key',
        cors_proxy_url: 'https://your-worker.workers.dev',
        daily_summary_system_prompt: null,
        daily_summary_user_prompt: null,
        book_rec_system_prompt: null,
        book_rec_user_prompt: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])
  }),

  // Supabase REST API - topics
  http.get('https://*.supabase.co/rest/v1/topics', () => {
    return HttpResponse.json([
      {
        id: 'topic-1',
        user_id: 'test-user-id',
        name: 'Technology',
        rss_feeds: ['https://example.com/feed.xml'],
        position: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])
  }),

  // Supabase REST API - articles
  http.get('https://*.supabase.co/rest/v1/articles', () => {
    return HttpResponse.json([])
  }),

  // Supabase REST API - daily_summaries
  http.get('https://*.supabase.co/rest/v1/daily_summaries', () => {
    return HttpResponse.json([])
  }),

  // Supabase REST API - book_lists
  http.get('https://*.supabase.co/rest/v1/book_lists', () => {
    return HttpResponse.json([])
  }),

  // Supabase REST API - POST/upsert operations
  http.post('https://*.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({ success: true })
  }),

  // Supabase REST API - DELETE operations
  http.delete('https://*.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({ success: true })
  }),
]

// Create and export the server
export const server = setupServer(...handlers)
