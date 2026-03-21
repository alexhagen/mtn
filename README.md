# Multi-Timescale News (MNT)

A multi-timescale news aggregation and reading application that helps you stay informed across daily news, monthly reading, and quarterly book recommendations.

## Features

### 1. Daily News Aggregation
- Configure up to 3 topics with custom RSS feeds
- AI-powered analysis identifies themes across multiple sources
- Rich markdown summaries with source links
- Notes where sources agree/disagree
- 24-hour caching with manual refresh
- Real-time streaming progress display

### 2. Reading List
- Save up to 4 articles per month for later reading
- Automatic content extraction with readability
- Word count display (highlights long-form >4000 words)
- Clean reading interface
- Mark articles as "done" when finished

### 3. Quarterly Book Recommendations
- AI-generated book recommendations based on your topics
- Mix of popular and scholarly works
- Purchase links (Amazon, Bookshop.org)
- Track read status locally

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **UI:** Material UI (muted macOS-like theme)
- **Storage:** IndexedDB (local) or Supabase (cloud sync)
- **Authentication:** Supabase Auth (Google, GitHub, Apple)
- **AI:** Anthropic Claude API with streaming
- **RSS:** fast-xml-parser
- **Article Extraction:** @mozilla/readability + jsdom
- **CORS Proxy:** Cloudflare Worker

## Deployment Options

MTN supports three deployment modes:

### 1. **Local Only** (Default)
- No account needed
- Data stored in browser IndexedDB
- Works offline
- Perfect for personal use

### 2. **Cloud Sync** (Hosted)
- Sign in with Google/GitHub/Apple
- Data syncs across devices
- Hosted on Supabase + Cloudflare Pages
- See [DEPLOYMENT.md](DEPLOYMENT.md) for setup

### 3. **Self-Hosted** (Open Source)
- Run your own Supabase instance with Docker
- Full control over your data
- See [SELF_HOSTING.md](SELF_HOSTING.md) for setup

## Quick Start (Local Mode)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```bash
# For local-only mode, leave Supabase vars empty
VITE_STORAGE_MODE=local
VITE_CORS_PROXY_URL=https://your-worker.workers.dev
```

### 3. Deploy CORS Proxy

```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Configure the App

1. Navigate to Settings
2. Enter your Anthropic API key
3. Enter your CORS proxy URL
4. Add topics and RSS feeds

## Cloud Sync Setup

To enable cloud sync across devices:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Run the database migration** from `supabase/migrations/20260321_initial_schema.sql`
3. **Configure OAuth providers** (Google, GitHub, Apple) in Supabase dashboard
4. **Update `.env.local`**:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_STORAGE_MODE=cloud
   ```
5. **Sign in** via the app and your data will sync automatically

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment instructions.

## Usage

### Daily Summary
1. Configure topics and RSS feeds in Settings
2. Navigate to Daily Summary
3. Click "Generate Summary" or wait for automatic generation
4. View AI-generated analysis of recent articles
5. Click "Refresh" to bypass 24-hour cache

### Reading List
1. Click "Save Article" and enter a URL
2. Article content is extracted automatically
3. View word count (long-form articles highlighted)
4. Click an article to read in clean interface
5. Click "Done Reading" to remove from list

### Books
1. Navigate to Books tab
2. Click "Generate Recommendations"
3. AI analyzes your topics and suggests relevant books
4. Click purchase links to buy
5. Mark books as read

## Architecture

### Storage Layer
- **Local Mode**: IndexedDB via `idb` library
- **Cloud Mode**: Supabase Postgres with Row-Level Security (RLS)
- **Abstraction**: `StorageBackend` interface supports both seamlessly
- **Daily summaries**: Always cached locally (not synced)

### Authentication (Cloud Mode)
- OAuth 2.0 via Supabase Auth
- Supports Google, GitHub, Apple sign-in
- JWT tokens with automatic refresh
- Session persisted in browser

### Agentic Framework
- Uses Anthropic's tool use for structured generation
- Streaming progress display
- Collapses "thinking" when finalization starts
- Caches results to conserve tokens

### CORS Proxy
- Minimal Cloudflare Worker
- Pass-through only (no logging/storage)
- Whitelisted domains
- Free tier sufficient for personal use

## Security

- **API keys**: Encrypted at rest (base64 in cloud, IndexedDB encryption in local)
- **Row-Level Security**: Supabase RLS ensures users only access their own data
- **OAuth**: Industry-standard authentication flow
- **HTTPS**: All traffic encrypted in transit
- **No logging**: CORS proxy doesn't log request bodies
- **Open source**: Full transparency, self-hostable

## Development

### Project Structure

```
mtn/
├── src/
│   ├── routes/          # Page components
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── theme.ts         # MUI theme
│   └── App.tsx          # Main app
├── cloudflare-worker/   # CORS proxy
└── PLAN.md              # Implementation plan
```

### Key Services

- **storage.ts:** IndexedDB wrapper
- **rss.ts:** RSS feed fetching/parsing
- **agent.ts:** Anthropic AI integration
- **readability.ts:** Article content extraction

## Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Deploy to production (Supabase + Cloudflare Pages)
- **[SELF_HOSTING.md](SELF_HOSTING.md)**: Run your own instance with Docker
- **[CLOUD_MIGRATION_PLAN.md](CLOUD_MIGRATION_PLAN.md)**: Technical architecture details
- **[TEST_GUIDE.md](TEST_GUIDE.md)**: Testing strategy and guidelines

## Future Enhancements

- [ ] Native SwiftUI app (iOS, iPadOS, macOS) with cloud sync
- [ ] Proper client-side encryption for API keys (Web Crypto API)
- [ ] Data export/import functionality
- [ ] PWA support for offline reading
- [ ] Email digest option
- [ ] RSS feed discovery/suggestions

## License

MIT

## Contributing

This is a personal project, but suggestions and bug reports are welcome via issues.
