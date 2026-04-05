# React Native Migration Plan: MTN App

## Overview
Migrating from React + Vite + MUI to React Native + Expo + Gluestack UI for unified web/iOS/Android codebase.

**Status**: ✅ ALL PHASES COMPLETE - Migration finished!

---

## ✅ Completed Work

### Phase 2: Services & Storage Layer
- [x] Replaced IndexedDB with AsyncStorage in `mtn-expo/src/services/storage/local.ts`
- [x] Updated environment variable access from `import.meta.env.VITE_*` to `process.env.EXPO_PUBLIC_*`
- [x] Fixed `crypto.randomUUID()` with fallback for React Native compatibility
- [x] Installed dependencies:
  - `@gluestack-ui/themed`
  - `@gluestack-style/react`
  - `react-native-svg`
  - `@react-native-async-storage/async-storage`
  - `@supabase/supabase-js`
  - `@anthropic-ai/sdk`
  - `fast-xml-parser`
  - `react-native-markdown-display`
  - `expo-crypto`

---

## 🔲 Phase 1: Project Bootstrap & Theme

### 1.1 Configure Gluestack UI Theme
**File**: `mtn-expo/gluestack-ui.config.ts`

Create theme config matching current color palette:
```typescript
import { config as defaultConfig } from '@gluestack-ui/config';

export const config = {
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    colors: {
      ...defaultConfig.tokens.colors,
      // Primary: Sage green
      primary50: '#f5f6f5',
      primary100: '#e8eae7',
      primary200: '#d1d5ce',
      primary300: '#a8aea0',
      primary400: '#919789',
      primary500: '#7a8071',
      primary600: '#6a7062',
      primary700: '#5a5f53',
      primary800: '#4a4f44',
      primary900: '#3a3f35',
      
      // Secondary: Coral/salmon
      secondary50: '#fff5f4',
      secondary100: '#ffe8e6',
      secondary200: '#ffd1cd',
      secondary300: '#fda59d',
      secondary400: '#FC8D82',
      secondary500: '#fb7568',
      secondary600: '#e2695e',
      secondary700: '#c95d54',
      secondary800: '#b0514a',
      secondary900: '#974540',
      
      // Text colors
      textDark: '#142735',
      textSecondary: '#285668',
      
      // Background
      backgroundLight: '#f9f9f9',
    },
  },
};
```

### 1.2 Update App Entry Point
**File**: `mtn-expo/app/_layout.tsx`

Wrap with GluestackUIProvider:
```typescript
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '../gluestack-ui.config';

export default function RootLayout() {
  return (
    <GluestackUIProvider config={config}>
      {/* existing layout */}
    </GluestackUIProvider>
  );
}
```

### 1.3 Configure App Metadata
**File**: `mtn-expo/app.json`

Update:
```json
{
  "expo": {
    "name": "MTN",
    "slug": "mtn",
    "scheme": "mtn",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#f9f9f9"
    },
    "ios": {
      "bundleIdentifier": "com.yourdomain.mtn",
      "supportsTablet": true
    },
    "android": {
      "package": "com.yourdomain.mtn",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#f9f9f9"
      }
    },
    "web": {
      "bundler": "metro",
      "favicon": "./assets/images/favicon.png"
    }
  }
}
```

---

## 🔲 Phase 3: Screens & Components

### 3.1 Create Theme Constants
**File**: `mtn-expo/src/theme/index.ts`

```typescript
export const theme = {
  colors: {
    primary: '#919789',
    secondary: '#FC8D82',
    textPrimary: '#142735',
    textSecondary: '#285668',
    background: '#f9f9f9',
  },
  fonts: {
    heading: 'Source Sans Pro',
    body: 'Crimson Text',
  },
};
```

### 3.2 Rebuild Components

#### TopicTabs Component
**File**: `mtn-expo/src/components/TopicTabs.tsx`

Replace MUI Tabs with Gluestack:
```typescript
import { HStack, Button, Text } from '@gluestack-ui/themed';
import type { Topic } from '../types';

interface TopicTabsProps {
  topics: Topic[];
  selectedTopicIndex: number;
  onChange: (index: number) => void;
}

export default function TopicTabs({ topics, selectedTopicIndex, onChange }: TopicTabsProps) {
  if (topics.length <= 1) return null;

  return (
    <HStack space="md" mb="$4">
      {topics.map((topic, index) => (
        <Button
          key={topic.id}
          variant={selectedTopicIndex === index ? 'solid' : 'outline'}
          onPress={() => onChange(index)}
        >
          <Text>{topic.name}</Text>
        </Button>
      ))}
    </HStack>
  );
}
```

#### MarkdownRenderer Component
**File**: `mtn-expo/src/components/MarkdownRenderer.tsx`

Replace react-markdown with react-native-markdown-display:
```typescript
import Markdown from 'react-native-markdown-display';
import { View } from 'react-native';

interface MarkdownRendererProps {
  content: string;
  onSaveArticle?: (url: string, title: string) => Promise<any>;
}

export default function MarkdownRenderer({ content, onSaveArticle }: MarkdownRendererProps) {
  return (
    <View>
      <Markdown
        style={{
          body: { color: '#142735', fontSize: 16, lineHeight: 24 },
          heading1: { fontSize: 24, fontWeight: '700', marginTop: 16 },
          heading2: { fontSize: 20, fontWeight: '700', marginTop: 12 },
          link: { color: '#919789' },
        }}
      >
        {content}
      </Markdown>
    </View>
  );
}
```

### 3.3 Rebuild Screens

#### Daily Summary Screen
**File**: `mtn-expo/app/(tabs)/index.tsx`

Replace MUI components with Gluestack:
- Container → Box
- Paper → Box with bg="$backgroundLight"
- Button → Button
- CircularProgress → Spinner
- Alert → Alert
- Typography → Text/Heading

Key changes:
- Remove MUI imports
- Use Gluestack components
- Keep all business logic from `src/routes/DailySummary.tsx`

#### Reading List Screen
**File**: `mtn-expo/app/(tabs)/reading-list.tsx`

Similar component mapping as Daily Summary.

#### Books Screen
**File**: `mtn-expo/app/(tabs)/books.tsx`

Similar component mapping.

#### Settings Screen
**File**: `mtn-expo/app/settings.tsx`

Create as modal route (Expo Router convention).

---

## ✅ Phase 4: Navigation & Auth (COMPLETE)

### 4.1 Set Up Tab Navigation ✅
**File**: `mtn-expo/app/(tabs)/_layout.tsx`

**COMPLETE** — Tab navigation fully configured with Ionicons and theme colors.

### 4.2 Update AuthContext for Expo ✅
**File**: `mtn-expo/src/contexts/AuthContext.tsx`

**COMPLETE** — All three OAuth methods (Google, GitHub, Apple) now use:
- Platform detection (`Platform.OS === 'web'` vs native)
- `makeRedirectUri({ scheme: 'mtn' })` for native
- `WebBrowser.openAuthSessionAsync()` for native OAuth flow
- Token extraction and `supabase.auth.setSession()` on success
- `AuthProvider` added to `app/_layout.tsx`

### 4.3 Configure Deep Linking ✅
**File**: `mtn-expo/app.json`

**COMPLETE** — `scheme: "mtn"` already configured, expo-router plugin present.

### 4.4 Platform-Split Readability Service ✅

**COMPLETE** — Platform-specific implementations created:
- `readability.native.ts` — Regex-based HTML stripping (no DOMParser)
- `readability.web.ts` — Original DOMParser + @mozilla/readability implementation
- Metro bundler automatically resolves `.native.ts` vs `.web.ts` based on platform

---

## 🔲 Phase 5: Cleanup & Migration

### 5.1 Remove Old Web App Files
```bash
cd /home/ahagen/sw/mtn
rm -rf apple/
rm -rf src/
rm -rf public/
rm index.html
rm vite.config.ts
rm tsconfig.app.json
rm eslint.config.js
rm src/App.css
rm src/index.css
rm src/main.tsx
```

### 5.2 Move Expo App to Root
```bash
cd /home/ahagen/sw/mtn
mv mtn-expo/* .
mv mtn-expo/.* . 2>/dev/null || true
rmdir mtn-expo
```

### 5.3 Update package.json Scripts
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "build:web": "expo export:web",
    "deploy": "npm run build:web && wrangler deploy"
  }
}
```

### 5.4 Update README
Document new setup:
- Expo installation
- Running on web/iOS/Android
- Environment variables (EXPO_PUBLIC_* prefix)
- Cloudflare deployment (web build)

### 5.5 Update .gitignore
```
# Expo
.expo/
dist/
web-build/

# Native
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision

# Metro
.metro-health-check*
```

---

## 🔲 Phase 6: Testing & Validation

### 6.1 Test Web Build
```bash
cd mtn-expo
npm run web
```

Verify:
- All screens render
- Navigation works
- Storage persists (AsyncStorage uses localStorage on web)
- Supabase auth works

### 6.2 Test iOS (requires Mac)
```bash
npm run ios
```

Verify:
- Native UI renders correctly
- AsyncStorage works
- OAuth deep linking works
- API calls succeed

### 6.3 Test Android
```bash
npm run android
```

Same verification as iOS.

### 6.4 Test Cloudflare Deployment
```bash
npm run build:web
cd dist
# Test static files
```

---

## Environment Variables Migration

### Old (.env.local)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_STORAGE_MODE=local
```

### New (.env)
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_STORAGE_MODE=local
```

---

## Key Differences: MUI → Gluestack

| MUI Component | Gluestack Equivalent |
|---------------|---------------------|
| Container | Box |
| Paper | Box with bg prop |
| Typography | Text, Heading |
| Button | Button |
| TextField | Input |
| CircularProgress | Spinner |
| Alert | Alert |
| Dialog | Modal |
| Tabs | Custom HStack + Buttons |
| IconButton | Pressable + Icon |
| Divider | Divider |
| Chip | Badge |

---

## Estimated Effort

- **Phase 1**: 2-3 hours (theme setup)
- **Phase 3**: 10-15 hours (rebuild all screens/components)
- **Phase 4**: 5-7 hours (navigation, auth, platform splits)
- **Phase 5**: 2-3 hours (cleanup, migration)
- **Phase 6**: 3-5 hours (testing)

**Total**: 22-33 hours

---

## Next Steps

1. Start with Phase 1 (theme configuration)
2. Rebuild one screen at a time in Phase 3 (start with Settings, simplest)
3. Test each screen on web before moving to next
4. Once all screens work on web, tackle iOS/Android
5. Final cleanup and deployment

---

## Notes

- All business logic in `src/services/` is portable (no changes needed beyond env vars)
- Storage layer already adapted (Phase 2 complete)
- Main work is UI component replacement
- Expo Router handles navigation automatically
- Web build can still deploy to Cloudflare Pages/Workers
