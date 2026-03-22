# Testing Guide

This project includes comprehensive testing to verify the app works correctly.

## Quick Start

```bash
# Run unit tests (fast, no browser needed)
npm test

# Run E2E tests (requires dev server)
npm run test:e2e

# Open Cypress UI for interactive testing
npm run cy:open

# Run tests in watch mode during development
npm run test:watch
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

## Test Coverage

### What's Tested
- ✅ App renders without blank screen
- ✅ Navigation between pages
- ✅ Settings form (API key, topics, RSS feeds)
- ✅ RSS feed date filtering
- ✅ Word counting for articles
- ✅ Long-form article detection
- ✅ Date/ID generation utilities

### What's Not Tested (requires external services)
- ❌ Actual RSS feed fetching (needs CORS proxy)
- ❌ Article extraction (needs CORS proxy)
- ❌ AI summary generation (needs Anthropic API)
- ❌ Book recommendations (needs Anthropic API)

## CI/CD Integration

The test commands are designed for CI/CD:

```yaml
# Example GitHub Actions
- run: npm test
- run: npm run build
- run: npm run test:e2e
```

All commands exit with proper status codes for CI systems.
