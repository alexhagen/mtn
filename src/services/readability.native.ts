// React Native implementation of readability service (no DOM)
// Uses regex-based HTML stripping instead of @mozilla/readability

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

    // Simple HTML stripping for native
    const content = stripHtml(html);
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

    // Extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract content from <article> or <body>
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const rawContent = articleMatch ? articleMatch[1] : (bodyMatch ? bodyMatch[1] : html);

    const content = rawContent;
    const textContent = stripHtml(rawContent);
    const length = textContent.length;
    const excerpt = textContent.substring(0, 200).trim();

    // Try to extract byline
    const bylineMatch = html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i);
    const byline = bylineMatch ? bylineMatch[1] : '';

    // Try to extract site name
    const siteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    const siteName = siteMatch ? siteMatch[1] : '';

    return {
      title,
      content,
      textContent,
      length,
      excerpt,
      byline,
      dir: '',
      siteName,
      lang: '',
    };
  } catch (error) {
    console.error(`Error extracting article from ${url}:`, error);
    throw error;
  }
}

function stripHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
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
