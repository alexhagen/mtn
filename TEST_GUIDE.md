# Testing Guide

This project includes comprehensive testing with mocking, coverage reporting, and CI integration for both the React web app and Swift macOS/iOS app.

## Quick Start

### Web App (React + Vite)

```bash
# Run unit tests (fast, no browser needed)
npm test

# Run unit tests with coverage (95% threshold)
npm run test:coverage

# Run E2E tests (requires dev server)
npm run test:e2e

# Open Cypress UI for interactive testing
npm run cy:open

# Run tests in watch mode during development
npm run test:watch
```

### Swift App (macOS/iOS)

```bash
cd apple

# Generate Xcode project
xcodegen generate

# Run tests for macOS
xcodebuild test \
  -scheme MTN-macOS \
  -destination 'platform=macOS' \
  -enableCodeCoverage YES

# Run tests for iOS
xcodebuild test \
  -scheme MTN-iOS \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -enableCodeCoverage YES
```

## Test Structure

### Unit Tests (Vitest)
Located in `src/services/__tests__/`, these test pure logic functions:

- **rss.test.ts** - RSS feed parsing and date filtering
- **readability.test.ts** - Word counting and long-form detection
- **storage.test.ts** - Date/ID generation utilities

Run with: `npm test`

### E2E Tests (Cypress)
Located in `cypress/e2e/`, these test the full app in a browser:

- **app-renders.cy.ts** - App loads without blank screen
- **navigation.cy.ts** - Tab navigation works
- **settings.cy.ts** - Settings form functionality
- **daily-summary.cy.ts** - Daily summary page behavior
- **reading-list.cy.ts** - Reading list management
- **books.cy.ts** - Book recommendations page

Run with: `npm run test:e2e` (starts dev server automatically)

## Autonomous Development Workflow

The test suite enables autonomous development by providing:

1. **Fast feedback** - Unit tests run in <1 second
2. **Confidence** - E2E tests verify the app actually works in a browser
3. **Regression prevention** - Tests catch breaking changes
4. **Documentation** - Tests show how features should work

### Example Workflow

```bash
# 1. Make code changes
# 2. Run unit tests to verify logic
npm test

# 3. Run E2E tests to verify UI
npm run test:e2e

# 4. If tests pass, the app is working!
```

## Mocking Strategy

### Web App (React)

| Dependency | Mocking Approach | Tool |
|---|---|---|
| **Anthropic SDK** | Module mock | `vi.mock('@anthropic-ai/sdk')` |
| **IndexedDB (idb)** | Module mock | `vi.mock('idb')` |
| **Network requests** | HTTP interception | MSW (Mock Service Worker) |
| **Supabase client** | Module mock | `vi.mock('../services/supabase')` |
| **DOMParser** | Global stub | `vi.stubGlobal('DOMParser')` |

**MSW Handlers** (`src/test/mocks/server.ts`):
- CORS proxy for RSS feeds and article extraction
- Supabase REST API endpoints (user_settings, topics, articles, summaries, book_lists)

### Swift App (macOS/iOS)

| Service | Mocking Approach |
|---|---|
| **StorageProtocol** | `MockStorageService` (in-memory) |
| **Network requests** | `URLProtocol` subclass (future) |
| **Services** | Protocol-based test doubles (future) |

The Swift app uses **protocol-based dependency injection** for testability. No external mocking libraries are needed.

## Test Coverage

### Coverage Thresholds

Both platforms enforce **95% coverage** for:
- Statements
- Branches
- Functions
- Lines

### Web App Coverage

Run `npm run test:coverage` to generate:
- **Text report** (terminal output)
- **HTML report** (`coverage/index.html`)
- **LCOV report** (`coverage/lcov.info` for CI)
- **JSON summary** (`coverage/coverage-summary.json` for PR comments)

### Swift App Coverage

Run tests with `-enableCodeCoverage YES` to generate:
- **Xcode coverage report** (`.xcresult` bundle)
- **JSON export** via `xcrun xccov view --report --json`

### What's Tested

#### Web App
- ✅ Anthropic API streaming (thinking + finalization)
- ✅ Encryption/decryption (AES-256-GCM)
- ✅ IndexedDB storage operations
- ✅ RSS feed parsing and date filtering
- ✅ Readability extraction and word counting
- ✅ React component rendering
- ✅ E2E user flows (navigation, settings, summaries)

#### Swift App
- ✅ Local storage (JSON file persistence)
- ✅ DailySummary model (expiration logic, Codable)
- ✅ Storage protocol conformance

### What's Not Tested (requires external services)
- ❌ Live Anthropic API calls
- ❌ Live Supabase database operations
- ❌ Live RSS feed fetching from real sources
- ❌ OAuth flows (Google, GitHub, Apple Sign In)

## CI/CD Integration

### GitHub Actions Workflow

The project includes `.github/workflows/test.yml` with:

1. **Web App Tests**
   - Unit tests with coverage
   - Build verification
   - E2E tests with Cypress
   - Coverage upload to Codecov
   - PR comment with coverage report (via `vitest-coverage-report-action`)

2. **Swift App Tests**
   - macOS test execution
   - Coverage extraction
   - Coverage upload to Codecov

### PR Coverage Reporting

Pull requests automatically receive:
- **Vitest Coverage Report** (inline comment with tables)
- **Codecov Status Check** (pass/fail based on coverage change)
- **Coverage diff** (lines added/removed, coverage % change)

### Setup Required

1. Add `CODECOV_TOKEN` secret to GitHub repository
2. Sign up at [codecov.io](https://codecov.io) (free for open source)
3. Coverage reports will appear on PRs automatically

## Writing New Tests

### Web App Example

```typescript
// src/services/__tests__/my-service.test.ts
import { describe, it, expect, vi } from 'vitest'
import { myFunction } from '../my-service'

describe('MyService', () => {
  it('should do something', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })
})
```

### Swift App Example

```swift
// apple/MTNTests/MyServiceTests.swift
import XCTest
@testable import MTN

final class MyServiceTests: XCTestCase {
    func testSomething() async throws {
        let service = MyService()
        let result = try await service.doSomething()
        XCTAssertEqual(result, "expected")
    }
}
```

## Troubleshooting

### Web App

**Tests fail with "Cannot find module"**
- Run `npm install` to ensure all dependencies are installed
- Check that `vitest.config.ts` includes the correct `setupFiles`

**MSW handlers not working**
- Verify `src/test/setup.ts` is imported in `vitest.config.ts`
- Check that MSW server is started in `beforeAll` hook

**Coverage below threshold**
- Run `npm run test:coverage` to see uncovered lines
- Add tests for uncovered code paths
- Update thresholds in `vitest.config.ts` if needed

### Swift App

**Tests not found**
- Run `xcodegen generate` to regenerate Xcode project
- Ensure test files are in `apple/MTNTests/` directory
- Check that `project.yml` includes test targets

**Coverage not generated**
- Add `-enableCodeCoverage YES` flag to `xcodebuild test`
- Check that `gatherCoverageData: true` is set in `project.yml`
