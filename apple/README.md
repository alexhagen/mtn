# MTN - Native Apple App

Native SwiftUI implementation of Multi-Timescale News for iOS, iPadOS, and macOS with optional cloud sync.

## Features

- **Daily Summary** — AI-powered news summaries from RSS feeds with streaming progress
- **Reading List** — Save up to 4 articles per month with automatic content extraction
- **Books** — Quarterly AI-generated book recommendations
- **Settings** — Configure API key, CORS proxy, and topics with RSS feeds
- **Cloud Sync** — Optional cross-device sync via Supabase (Google, GitHub, Apple sign-in)

## Requirements

- **Xcode 14.2+** (works on macOS Monterey 12+)
- **iOS 16.0+** / **iPadOS 16.0+** / **macOS 13.0+**
- **Anthropic API Key** (get one at https://console.anthropic.com)
- **CORS Proxy** (use the Cloudflare Worker from `../cloudflare-worker/`)
- **Supabase Project** (optional, for cloud sync only)

## Setup

### 1. Generate Xcode Project

This project uses [XcodeGen](https://github.com/yonaskolb/XcodeGen) to generate the Xcode project from `project.yml`.

```bash
# Install XcodeGen (if not already installed)
brew install xcodegen

# Generate the Xcode project
cd apple
xcodegen generate
```

This will create `MTN.xcodeproj` which you can open in Xcode.

### 2. Deploy CORS Proxy

The app requires the same CORS proxy as the web version:

```bash
cd ../cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

Copy the deployed worker URL (e.g., `https://mtn-cors-proxy.your-subdomain.workers.dev`)

### 3. Configure Cloud Sync (Optional)

If you want to enable cloud sync across devices:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the database migration from `../supabase/migrations/20260321_initial_schema.sql`
3. Configure OAuth providers (Google, GitHub, Apple) in Supabase dashboard
4. Edit `MTN/Info.plist` and add your Supabase credentials:
   ```xml
   <key>SUPABASE_URL</key>
   <string>https://your-project.supabase.co</string>
   <key>SUPABASE_ANON_KEY</key>
   <string>your-anon-key-here</string>
   ```

**Note:** If you skip this step, the app will work in local-only mode (data stored on device).

### 4. Build and Run

1. Open `MTN.xcodeproj` in Xcode
2. Select your target device (iPhone, iPad, or Mac)
3. Build and run (⌘R)

### 5. Configure the App

1. Navigate to the **Settings** tab
2. **(Optional)** Sign in for cloud sync using Google, GitHub, or Apple
3. Enter your **Anthropic API Key**
4. Enter your **CORS Proxy URL**
5. Add up to 3 topics with RSS feeds for each

## Architecture

### Models (Codable Structs)
- `AppSettings` — API key, proxy URL, topics
- `Topic` — Topic name with RSS feed URLs
- `SavedArticle` — Reading list articles
- `DailySummary` — Cached AI summaries (24h expiry)
- `BookList` / `BookItem` — Quarterly book recommendations

### Services
- **StorageService** — JSON file-based persistence using `FileManager`
- **RSSService** — Fetch and parse RSS/Atom feeds via proxy
- **AnthropicService** — Streaming Claude API integration
- **ReadabilityService** — Article content extraction from HTML

### Views (SwiftUI)
- **DailySummaryView** — Topic picker, generate/refresh, streaming progress
- **ReadingListView** — Article cards, save dialog, word count badges
- **ArticleReaderView** — Clean reading interface
- **BooksView** — Generate recommendations, purchase links, read status
- **SettingsView** — API key, proxy URL, topic/feed management

### Platform Adaptations
- **iPhone** — Single-column layout, tab bar at bottom
- **iPad** — `NavigationSplitView` for reading list (sidebar + detail)
- **macOS** — Native window chrome, keyboard shortcuts

## Storage

### Local Mode (Default)
All data is stored locally as JSON files in the app's Documents directory:
- `settings.json` — App settings
- `articles.json` — Saved articles
- `summaries.json` — Cached daily summaries (always local)
- `bookLists.json` — Book recommendations

### Cloud Mode (Optional)
When signed in, data syncs to Supabase Postgres:
- **Settings** — API key (encrypted), CORS proxy, topics, prompts
- **Articles** — Reading list synced across devices
- **Book Lists** — Recommendations synced across devices
- **Summaries** — Always cached locally (not synced for performance)

The app automatically switches between local and cloud storage based on sign-in state.

## Development

### Project Structure

```
apple/
├── project.yml              # XcodeGen configuration
├── MTN/
│   ├── MTNApp.swift         # App entry point
│   ├── ContentView.swift    # Tab-based navigation
│   ├── Models/              # Codable data models
│   ├── Services/            # Business logic
│   ├── Views/               # SwiftUI views
│   ├── Assets.xcassets/     # App icon, colors
│   └── Info.plist
└── README.md
```

### Regenerating the Project

If you modify `project.yml`, regenerate the Xcode project:

```bash
xcodegen generate
```

### Adding Dependencies

This project uses:
- **Supabase Swift SDK** — For cloud sync and authentication (optional)
- **Foundation & SwiftUI** — Apple's standard frameworks

To add more dependencies, edit `project.yml` and run `xcodegen generate`.

## Compatibility Notes

- **No SwiftData** — Uses simple JSON file storage for compatibility with Xcode 14.2
- **No Core Data** — Keeps the codebase simple and portable
- **iOS 16+ / macOS 13+** — Required for `NavigationSplitView` and modern SwiftUI features

## Troubleshooting

### "Cannot find type 'StorageService' in scope"

Make sure all files are included in the Xcode project. Run `xcodegen generate` to regenerate.

### "Failed to fetch RSS feed"

Check that your CORS proxy is deployed and the URL is correct in Settings.

### "API key invalid"

Verify your Anthropic API key at https://console.anthropic.com

### App crashes on launch

Check the Xcode console for error messages. Most likely a JSON parsing error in storage files.

### Cloud sync not working

1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `Info.plist`
2. Check that OAuth providers are configured in Supabase dashboard
3. Ensure the OAuth redirect URI is set to `mtn://auth/callback`
4. Check Xcode console for authentication errors

### "Sign In for Cloud Sync" button is disabled

This means Supabase is not configured. Add your Supabase URL and anon key to `Info.plist` to enable cloud sync.

## License

MIT (same as parent project)
