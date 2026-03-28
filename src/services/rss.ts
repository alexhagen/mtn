import { XMLParser } from 'fast-xml-parser';
import type { RSSFeedItem } from '../types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export async function fetchRSSFeed(
  feedUrl: string,
  proxyUrl: string
): Promise<RSSFeedItem[]> {
  try {
    // Fetch through CORS proxy
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: feedUrl,
        method: 'GET',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const parsed = parser.parse(xmlText);

    // Handle both RSS and Atom feeds
    let items: any[] = [];

    if (parsed.rss?.channel?.item) {
      items = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item];
    } else if (parsed.feed?.entry) {
      items = Array.isArray(parsed.feed.entry)
        ? parsed.feed.entry
        : [parsed.feed.entry];
    }

    return items.map((item) => normalizeItem(item));
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    throw error;
  }
}

function normalizeItem(item: any): RSSFeedItem {
  // Atom format - check for Atom-specific fields first
  if (item.updated || item.published || item.summary || item.content) {
    const link = typeof item.link === 'string' 
      ? item.link 
      : Array.isArray(item.link)
      ? item.link.find((l: any) => l?.['@_rel'] === 'alternate' || !l?.['@_rel'])?.[
          '@_href'
        ] || item.link[0]?.['@_href'] || ''
      : item.link?.['@_href'] || '';
    
    const title = typeof item.title === 'string'
      ? item.title
      : item.title?.['#text'] || 'Untitled';

    const content = typeof item.content === 'string'
      ? item.content
      : item.content?.['#text'] || item.summary || '';

    return {
      title,
      link,
      description: content || item.summary || '',
      pubDate: item.updated || item.published,
      content,
    };
  }

  // RSS format
  if (item.title || item.link) {
    return {
      title: item.title || 'Untitled',
      link: item.link || '',
      description: item['content:encoded'] || item.description || '',
      pubDate: item.pubDate,
      content: item['content:encoded'] || item.description || '',
    };
  }

  // Fallback
  return {
    title: 'Untitled',
    link: '',
    description: '',
  };
}

export function filterArticlesByDate(
  items: RSSFeedItem[],
  hoursAgo: number = 24
): RSSFeedItem[] {
  const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;

  return items.filter((item) => {
    // Include items without pubDate (better to show content than hide it)
    if (!item.pubDate) return true;

    const pubTime = new Date(item.pubDate).getTime();
    // Also include items with invalid dates
    if (isNaN(pubTime)) return true;
    
    return pubTime >= cutoffTime;
  });
}

export async function fetchMultipleFeeds(
  feedUrls: string[],
  proxyUrl: string
): Promise<RSSFeedItem[]> {
  const results = await Promise.allSettled(
    feedUrls.map((url) => fetchRSSFeed(url, proxyUrl))
  );

  const allItems: RSSFeedItem[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    } else {
      console.error('Failed to fetch feed:', result.reason);
    }
  }

  return allItems;
}
