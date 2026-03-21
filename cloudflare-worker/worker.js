// CORS Proxy for Multi-Timescale News
// This worker proxies requests to RSS feeds and the Anthropic API

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      const { url, method, headers, body } = await request.json();

      // Whitelist: only allow Anthropic API and RSS feeds
      const allowedDomains = [
        'api.anthropic.com',
        // Add common RSS feed domains or allow all for flexibility
      ];

      const targetUrl = new URL(url);
      
      // For Anthropic API, enforce strict domain check
      if (url.includes('anthropic.com')) {
        if (!allowedDomains.includes(targetUrl.hostname)) {
          return new Response('Forbidden: Domain not allowed', { status: 403 });
        }
      }

      // Make the proxied request
      const proxyHeaders = new Headers(headers || {});
      
      const proxyRequest = new Request(url, {
        method: method || 'GET',
        headers: proxyHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const response = await fetch(proxyRequest);
      const responseBody = await response.text();

      // Return with CORS headers
      return new Response(responseBody, {
        status: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        },
      });
    } catch (error) {
      return new Response(`Proxy error: ${error.message}`, {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
