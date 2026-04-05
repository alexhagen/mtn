# iOS Builds Without a Mac — EAS Build Guide

Since MTN is an **Expo** project, you can build and ship iOS apps entirely from Linux using **EAS Build** (Expo Application Services). No Mac required.

---

## Prerequisites

- [Expo account](https://expo.dev/signup) (free)
- [Apple Developer account](https://developer.apple.com) ($99/year — required for signing & TestFlight)
- Node.js + npm already installed

---

## One-Time Setup

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Log in to Expo

```bash
eas login
```

### 3. Configure EAS in the project

Run this from the repo root:

```bash
eas build:configure
```

This creates an `eas.json` file with build profiles. Accept the defaults or use the config below.

### Recommended `eas.json`

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## Triggering Builds

All commands run from your Linux machine — EAS builds on Apple Silicon Macs in Expo's cloud.

### TestFlight / Internal Testing Build

```bash
eas build --platform ios --profile preview
```

- EAS will walk you through Apple Developer credentials the first time
- It can automatically manage certificates and provisioning profiles — choose **yes** when prompted
- Build takes ~10–15 minutes
- You'll get a link to download or submit the `.ipa`

### App Store Production Build

```bash
eas build --platform ios --profile production
```

### Simulator Build (for testing without a device)

```bash
eas build --platform ios --profile development --local
# or cloud:
eas build --platform ios --profile development
```

---

## Submitting to TestFlight / App Store

After a successful build:

```bash
eas submit --platform ios
```

EAS will prompt for your App Store Connect credentials and upload automatically. Or link your Apple account once in the Expo dashboard to skip prompts.

---

## Free Tier Limits

| Plan | Price | Builds/month | Concurrent |
|------|-------|-------------|------------|
| Free | $0 | 30 (iOS + Android combined) | 1 |
| Production | $99/mo | Unlimited | 4 |

30 builds/month is plenty for a personal project.

---

## Workflow Summary

```bash
# Make changes to your code
git commit -am "your changes"

# Trigger iOS build
eas build --platform ios --profile preview

# When build completes, submit to TestFlight
eas submit --platform ios

# Or build + submit in one command
eas build --platform ios --profile production --auto-submit
```

---

## Alternatives Considered

| Option | Verdict |
|--------|---------|
| **EAS Build** ✅ | Best for Expo — zero Mac needed, handles signing |
| Xcode Cloud | Requires native Xcode project setup, more complex for Expo |
| GitHub Actions (macOS runner) | Possible but eats free minutes fast (10x cost) |
| MacinCloud | ~$1/hr on-demand remote Mac if you ever need a real GUI |
| EC2 Mac instances | Expensive ($1.30/hr, 24hr minimum), unreliable startup |

---

## Useful Links

- [EAS Build docs](https://docs.expo.dev/build/introduction/)
- [EAS Submit docs](https://docs.expo.dev/submit/introduction/)
- [Apple Developer enrollment](https://developer.apple.com/programs/enroll/)
- [Expo dashboard](https://expo.dev)
