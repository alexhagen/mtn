# Multi-Timescale News (MTN)

A multi-timescale news aggregation and reading application that helps you stay informed across daily news, monthly reading, and quarterly book recommendations. Built with React Native + Expo for unified web, iOS, and Android deployment.

## Features

### 1. Daily News Aggregation
- Configure up to 3 topics with custom RSS feeds
- AI-powered analysis identifies themes across multiple sources
- Rich markdown summaries with source links
- Notes where sources agree/disagree
- 24-hour caching with manual refresh
- Real-time streaming progress display

### 2. Reading List
- Save up to 4 articles per month for later reading (from daily summaries)
- Save articles manually with 12,000 word/month budget
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

- **Framework:** React Native + Expo (web, iOS, Android)
- **UI:** Gluestack UI (custom sage green + coral theme)
- **Storage:** AsyncStorage (local) or Supabase (cloud sync)
- **Authentication:** Supabase Auth (Google, GitHub, Apple)
- **AI:** Anthropic Claude API with streaming
- **RSS:** fast-xml-parser
- **Article Extraction:** Platform-specific readability implementations
- **CORS Proxy:** Cloudflare Worker

## Deployment Options

MTN supports three deployment modes:

### 1. **Local Only** (Default)
- No account needed
- Data stored in AsyncStorage (localStorage on web)
- Works offline
- Perfect for personal use

### 2. **Cloud Sync** (Hosted)
- Sign in with Google/GitHub/Apple
- Data synced via Supabase
- Access from multiple devices
- Automatic backup

### 3. **Self-Hosted**
- Run your own Supabase instance
- Full control over data
- See [SELF_HOSTING.md](./SELF_HOSTING.md)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Anthropic API key ([get one here](https://console.anthropic.com/))
- Cloudflare account (for CORS proxy)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mtn.git
cd mtn

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Environment Variables

Create a `.env.local` file:

```bash
# Required for cloud sync (optional for local-only)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Storage mode: 'local' or 'supabase'
EXPO_PUBLIC_STORAGE_MODE=local
```

### Running the App

```bash
# Start development server
npm start

# Run on specific platform
npm run web      # Web browser
npm run ios      # iOS simulator (Mac only)
npm run android  # Android emulator
```

### Deploy CORS Proxy

The app requires a Cloudflare Worker to proxy RSS feeds and article content:

```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

Copy the worker URL and add it to Settings in the app.

### Deploy Web App

```bash
# Build for web
npm run build:web

# Deploy to Cloudflare Pages
npm run deploy
```

## Configuration

### In-App Settings

1. **Anthropic API Key**: Your Claude API key for AI summaries
2. **CORS Proxy URL**: Your Cloudflare Worker URL
3. **Topics**: Add up to 3 topics with RSS feeds each
4. **Prompts**: Customize AI behavior (optional)

### Storage Modes

- **Local**: Data stored in AsyncStorage (no account needed)
- **Supabase**: Cloud sync with authentication

Set via `EXPO_PUBLIC_STORAGE_MODE` environment variable.

## Architecture

```
mtn/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Daily Summary
│   │   ├── reading-list.tsx
│   │   └── books.tsx
│   ├── _layout.tsx        # Root layout
│   └── modal.tsx          # Settings screen
├── src/
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts (Auth)
│   ├── services/          # Business logic
│   │   ├── agent.ts       # AI prompts
│   │   ├── rss.ts         # RSS parsing
│   │   ├── readability.{native,web}.ts  # Article extraction
│   │   ├── generation-pipeline.ts       # AI streaming
│   │   └── storage/       # Storage abstraction
│   ├── theme/             # Theme constants
│   └── types/             # TypeScript types
├── cloudflare-worker/     # CORS proxy
├── supabase/              # Database migrations
└── assets/                # Images, fonts

```

## Platform-Specific Notes

### Web
- Uses localStorage for AsyncStorage
- DOMParser for article extraction
- OAuth redirects work natively

### iOS/Android
- Uses native AsyncStorage
- Regex-based article extraction (no DOMParser)
- OAuth via expo-web-browser deep linking

## Development

### Testing

```bash
# Run unit tests (if configured)
npm test

# Test on multiple platforms
npm run web
npm run ios
npm run android
```

### Code Structure

- **Services**: Platform-agnostic business logic
- **Components**: Reusable UI with Gluestack
- **Screens**: Full-page views in `app/` directory
- **Storage**: Abstracted local/cloud storage

## Cost Estimates

### Anthropic API
- Daily summary: ~$0.01-0.05 per generation
- Book recommendations: ~$0.02-0.10 per quarter
- Monthly cost: ~$1-3 for daily use

### Cloudflare
- Worker: Free tier (100k requests/day)
- Pages: Free tier (unlimited static hosting)

### Supabase (if using cloud sync)
- Free tier: 500MB database, 1GB file storage
- Paid: $25/month for more resources

## Troubleshooting

### "No articles could be fetched"
- Check CORS proxy URL in Settings
- Verify RSS feed URLs are valid
- Check Cloudflare Worker logs

### "Failed to generate summary"
- Verify Anthropic API key
- Check API quota/billing
- Ensure articles were fetched successfully

### OAuth not working on mobile
- Verify `scheme: "mtn"` in app.json
- Check Supabase redirect URLs include `mtn://`
- Test deep linking with `npx uri-scheme open mtn:// --ios`

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Acknowledgments

- Built with [Expo](https://expo.dev/)
- UI powered by [Gluestack UI](https://gluestack.io/)
- AI by [Anthropic Claude](https://www.anthropic.com/)
- Storage by [Supabase](https://supabase.com/)
- Hosting by [Cloudflare](https://www.cloudflare.com/)
