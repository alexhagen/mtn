# Building MTN for iOS, iPadOS, and macOS

This guide walks you through building the native SwiftUI version of Multi-Timescale News (MTN) for Apple platforms.

## Prerequisites

### Required Software

- **macOS 12.0 (Monterey) or later**
- **Xcode 14.2 or later** — Download from the [Mac App Store](https://apps.apple.com/us/app/xcode/id497799835)
- **XcodeGen 2.15.0** — Project file generator
  ```bash
  brew install xcodegen@2.15.0
  ```
  > **Note:** This project requires XcodeGen **2.15.0** specifically. If you have a newer version installed, you can pin to 2.15.0 or install it manually from the [XcodeGen releases page](https://github.com/yonaskolb/XcodeGen/releases/tag/2.15.0).
- **Homebrew** (if not already installed) — [https://brew.sh](https://brew.sh)

### Required Services

1. **Anthropic API Key** — Get one at [console.anthropic.com](https://console.anthropic.com)
2. **CORS Proxy** — Deploy the Cloudflare Worker (see below)
3. **Supabase Project** (optional, for cloud sync only) — [supabase.com](https://supabase.com)

## Step 1: Generate the Xcode Project

The MTN app uses XcodeGen to generate the Xcode project from `project.yml`. This keeps the repository clean and avoids merge conflicts.

```bash
cd apple
xcodegen generate
```

This creates `MTN.xcodeproj` which you can now open in Xcode.

## Step 2: Deploy the CORS Proxy

The app requires a CORS proxy to fetch RSS feeds and extract article content. We provide a minimal Cloudflare Worker for this purpose.

### Install Wrangler (Cloudflare CLI)

```bash
npm install -g wrangler
```

### Deploy the Worker

```bash
cd ../cloudflare-worker
wrangler login
wrangler deploy
```

After deployment, you'll see a URL like:
```
https://mtn-cors-proxy.your-subdomain.workers.dev
```

**Save this URL** — you'll need it in the app settings.

## Step 3: Configure Cloud Sync (Optional)

If you want to sync data across devices, set up Supabase. Otherwise, skip to Step 4.

### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to initialize (~2 minutes)

### Run Database Migrations

In the Supabase dashboard:
1. Go to **SQL Editor**
2. Create a new query
3. Copy and paste the contents of `../supabase/migrations/20260321_initial_schema.sql`
4. Click **Run**

### Configure OAuth Providers

In the Supabase dashboard:
1. Go to **Authentication** → **Providers**
2. Enable **Google**, **GitHub**, and/or **Apple**
3. For each provider, set the **Redirect URL** to:
   ```
   mtn://auth/callback
   ```
4. Follow Supabase's instructions to configure each OAuth provider

### Add Supabase Credentials to Info.plist

Edit `MTN/Info.plist` and add your Supabase credentials:

```xml
<key>SUPABASE_URL</key>
<string>https://your-project.supabase.co</string>
<key>SUPABASE_ANON_KEY</key>
<string>your-anon-key-here</string>
```

**Find these values** in your Supabase dashboard under **Settings** → **API**.

> **Note:** If you skip this step, the app will work in **local-only mode** (data stored on device).

## Step 4: Open the Project in Xcode

```bash
open MTN.xcodeproj
```

Xcode will open and automatically resolve Swift Package dependencies (Supabase SDK).

## Step 5: Select Your Target Platform

In Xcode's toolbar, select your destination:

- **iPhone** — Choose any iPhone simulator or connected device
- **iPad** — Choose any iPad simulator or connected device
- **Mac** — Choose "My Mac" (requires Apple Silicon or Intel Mac)

## Step 6: Build and Run

Press **⌘R** or click the **Play** button in Xcode.

The app will build and launch on your selected platform.

## Step 7: Configure the App

On first launch, you'll need to configure the app:

1. Navigate to the **Settings** tab
2. **(Optional)** Sign in for cloud sync using Google, GitHub, or Apple
3. Enter your **Anthropic API Key**
4. Enter your **CORS Proxy URL** (from Step 2)
5. Add up to 3 topics with RSS feed URLs for each
6. Tap **Save**

### Example RSS Feeds

Here are some popular RSS feeds to get started:

**Technology:**
- `https://news.ycombinator.com/rss`
- `https://www.theverge.com/rss/index.xml`
- `https://techcrunch.com/feed/`

**News:**
- `https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml`
- `https://feeds.bbci.co.uk/news/rss.xml`
- `https://www.npr.org/rss/rss.php?id=1001`

**Science:**
- `https://www.nature.com/nature.rss`
- `https://www.sciencedaily.com/rss/all.xml`

## Step 8: Use the App

### Daily Summary

1. Navigate to **Daily Summary**
2. If you have multiple topics, use the segmented control to switch between them
3. Tap **Refresh** to generate a new summary (bypasses 24-hour cache)
4. Summaries are cached locally for 24 hours

### Reading List

1. Navigate to **Reading List**
2. Tap **+ Save Article**
3. Enter a URL and tap **Save**
4. The article content will be extracted automatically
5. You can save up to **4 articles per month**
6. Tap an article to read it
7. Tap **Done Reading** to remove it from your list

### Books

1. Navigate to **Books**
2. Tap **Generate** to get AI-powered book recommendations
3. Recommendations are based on your configured topics
4. Tap purchase links to buy books
5. Mark books as read to track your progress

## Platform-Specific Features

### iPhone
- Tab bar navigation at the bottom
- Single-column layout
- Swipe gestures for article deletion

### iPad
- Split view for reading list (sidebar + detail)
- Larger canvas for content
- Optimized for landscape orientation

### macOS
- Native window chrome
- Keyboard shortcuts
- Menu bar integration
- Optimized for desktop workflows

## Troubleshooting

### "Cannot find type 'StorageService' in scope"

Run `xcodegen generate` again to ensure all files are included in the project.

### "Failed to fetch RSS feed"

1. Verify your CORS proxy URL is correct in Settings
2. Test the proxy by visiting it in a browser (should return a JSON error)
3. Check that the RSS feed URL is valid

### "API key invalid"

1. Verify your Anthropic API key at [console.anthropic.com](https://console.anthropic.com)
2. Make sure you've entered it correctly in Settings (no extra spaces)
3. Check that your API key has sufficient credits

### App crashes on launch

1. Check the Xcode console for error messages
2. Most likely a JSON parsing error in storage files
3. Try deleting the app and reinstalling to clear local data

### Cloud sync not working

1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `Info.plist`
2. Check that OAuth providers are configured in Supabase dashboard
3. Ensure the OAuth redirect URI is set to `mtn://auth/callback`
4. Check Xcode console for authentication errors

### "Sign In for Cloud Sync" button is disabled

This means Supabase is not configured. Add your Supabase URL and anon key to `Info.plist` to enable cloud sync.

### Build fails with "Missing package product"

1. Go to **File** → **Packages** → **Reset Package Caches**
2. Clean build folder: **Product** → **Clean Build Folder** (⇧⌘K)
3. Rebuild the project

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
│   │   ├── Storage/         # Local & cloud storage
│   │   ├── AnthropicService.swift
│   │   ├── RSSService.swift
│   │   ├── ReadabilityService.swift
│   │   └── AuthService.swift
│   ├── Views/               # SwiftUI views
│   │   ├── DailySummaryView.swift
│   │   ├── ReadingListView.swift
│   │   ├── BooksView.swift
│   │   ├── SettingsView.swift
│   │   ├── SignInView.swift
│   │   ├── MarkdownView.swift
│   │   └── EmptyStateView.swift
│   ├── Assets.xcassets/     # App icon, colors
│   └── Info.plist           # App configuration
└── BUILD.md                 # This file
```

### Regenerating the Project

If you modify `project.yml` (e.g., add new files, change settings), regenerate the Xcode project:

```bash
xcodegen generate
```

### Adding Dependencies

To add Swift Package dependencies, edit `project.yml`:

```yaml
packages:
  NewPackage:
    url: https://github.com/owner/repo
    from: 1.0.0
```

Then add it to the target (add to both `MTN-iOS` and `MTN-macOS`):

```yaml
targets:
  MTN-iOS:
    dependencies:
      - package: NewPackage
        product: NewPackage
  MTN-macOS:
    dependencies:
      - package: NewPackage
        product: NewPackage
```

Run `xcodegen generate` to apply changes.

## Storage Modes

### Local Mode (Default)

- Data stored in JSON files in the app's Documents directory
- No account required
- Works offline
- Data stays on device

**Files:**
- `settings.json` — App settings
- `articles.json` — Saved articles
- `summaries.json` — Cached daily summaries (always local)
- `bookLists.json` — Book recommendations

### Cloud Mode (Optional)

- Sign in with Google, GitHub, or Apple
- Data syncs to Supabase Postgres
- Access from multiple devices
- Daily summaries remain local for performance

**Synced data:**
- Settings (API key encrypted, CORS proxy, topics)
- Articles (reading list)
- Book lists (recommendations)

**Not synced:**
- Daily summaries (cached locally for 24 hours)

## Architecture

### Models

All data models are `Codable` structs:
- `AppSettings` — API key, proxy URL, topics
- `Topic` — Topic name with RSS feed URLs
- `SavedArticle` — Reading list articles
- `DailySummary` — Cached AI summaries (24h expiry)
- `BookList` / `BookItem` — Quarterly book recommendations

### Services

- **StorageService** — Facade that switches between local and cloud storage
- **LocalStorageService** — JSON file-based persistence
- **SupabaseStorageService** — Cloud sync via Supabase
- **RSSService** — Fetch and parse RSS/Atom feeds
- **AnthropicService** — Streaming Claude API integration
- **ReadabilityService** — Article content extraction
- **AuthService** — OAuth authentication via Supabase

### Views

- **DailySummaryView** — Topic picker, generate/refresh, streaming progress
- **ReadingListView** — Article cards, save dialog, word count badges
- **ArticleReaderView** — Clean reading interface
- **BooksView** — Generate recommendations, purchase links, read status
- **SettingsView** — API key, proxy URL, topic/feed management
- **SignInView** — OAuth sign-in for cloud sync
- **MarkdownView** — Custom markdown renderer (iOS 16 compatible)
- **EmptyStateView** — Empty state UI (iOS 16 compatible)

## Compatibility

- **iOS 16.0+** — iPhone and iPad
- **macOS 13.0+** — Apple Silicon and Intel Macs
- **Xcode 14.2+** — Required for building
- **Swift 5.7+** — Language version

## License

MIT (same as parent project)

## Support

For issues or questions:
1. Check this BUILD.md guide
2. Review the main [README.md](../README.md)
3. Check the [apple/README.md](README.md) for architecture details
4. Open an issue on GitHub
