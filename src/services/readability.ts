import { Readability } from '@mozilla/readability';

export interface ExtractedArticle {
  title: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  byline: string;
  dir: string;
  siteName: string;
  lang: string;
}

export interface ArticleContent {
  content: string;
  wordCount: number;
}

export async function fetchArticleContent(
  url: string,
  proxyUrl: string
): Promise<ArticleContent> {
  try {
    // Fetch the article HTML through the proxy
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        method: 'GET',
      }),
    });

    if (!response.ok) {
      return { content: '', wordCount: 0 };
    }

    const html = await response.text();
    if (!html) {
      return { content: '', wordCount: 0 };
    }

    // Parse with browser DOMParser
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Extract content from article tag or body
    const article = doc.querySelector('article') || doc.body;
    const content = article?.textContent?.trim() || '';
    
    const wordCount = countWords(content);

    return {
      content,
      wordCount,
    };
  } catch (error) {
    return { content: '', wordCount: 0 };
  }
}

export async function extractArticleContent(
  url: string,
  proxyUrl: string
): Promise<ExtractedArticle> {
  try {
    // Fetch the article HTML through the proxy
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        method: 'GET',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse with browser DOMParser
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      throw new Error('Failed to parse article with Readability');
    }

    return {
      title: article.title || '',
      content: article.content || '',
      textContent: article.textContent || '',
      length: article.length || 0,
      excerpt: article.excerpt || '',
      byline: article.byline || '',
      dir: article.dir || '',
      siteName: article.siteName || '',
      lang: article.lang || '',
    };
  } catch (error) {
    console.error(`Error extracting article from ${url}:`, error);
    throw error;
  }
}

export function countWords(text: string): number {
  // Remove HTML tags if present
  const plainText = text.replace(/<[^>]*>/g, '');
  
  // Split by whitespace and filter out empty strings
  const words = plainText.trim().split(/\s+/).filter(word => word.length > 0);
  
  return words.length;
}

export function isLongForm(wordCount: number): boolean {
  return wordCount > 4000;
}
