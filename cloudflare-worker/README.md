# CORS Proxy for Multi-Timescale News

This Cloudflare Worker acts as a CORS proxy to enable the browser-based MNT app to fetch RSS feeds and communicate with the Anthropic API.

## Setup

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy the worker:
```bash
cd cloudflare-worker
wrangler deploy
```

4. After deployment, you'll receive a URL like:
```
https://mtn-cors-proxy.<your-subdomain>.workers.dev
```

5. Copy this URL and paste it into the MNT app Settings as the "CORS Proxy URL"

## Security

- The worker only proxies requests (doesn't store data)
- Your API key passes through in-memory only
- Rate limiting is handled by Cloudflare's free tier
- The worker enforces domain whitelisting for Anthropic API

## Testing

Test the worker with curl:

```bash
curl -X POST https://your-worker.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/feed.xml",
    "method": "GET"
  }'
```

## Customization

To restrict the proxy to specific domains, edit `worker.js` and add domains to the `allowedDomains` array.
