# Cross-Platform Behavioral Contracts

## Overview

MTN has three client implementations (web, macOS, iOS) that share business logic but are written in different languages (TypeScript, Swift). To ensure they behave identically without sharing code, we use **behavioral contracts** — JSON specification files that define expected inputs and outputs for core functions.

## Philosophy

- **Client-side logic** — All business logic lives in the client to minimize hosting costs and maximize portability
- **Native feel** — Each platform uses idiomatic code (TypeScript for web, Swift for Apple)
- **Shared behavior** — Despite different implementations, all platforms produce identical results
- **Test-driven** — Contracts are the single source of truth; implementations must pass contract tests

## Architecture

```
contracts/                              # Shared behavioral specifications
├── README.md                           # Contract system documentation
├── prompts.json                        # Default AI prompts (must be identical)
├── anthropic-tools.json                # Tool definitions for Anthropic API
├── word-counting.json                  # Text → word count mappings
├── date-filtering.json                 # Article filtering by date logic
├── book-parsing.json                   # Markdown → Book[] structure
├── date-utilities.json                 # Timestamp → quarter/month strings
├── long-form-threshold.json            # Word count → isLongForm boolean
├── model-pricing.json                  # Model → pricing table
└── storage-interface.json              # Required storage method signatures

src/services/__tests__/contracts.test.ts   # TypeScript contract tests
apple/MTNTests/ContractTests.swift          # Swift contract tests
```

## Contract Types

### Tier 1: Pure Logic Contracts
These verify deterministic functions produce identical outputs given identical inputs:

- **word-counting.json** — `countWords(text: string) → number`
- **date-filtering.json** — `filterArticlesByDate(articles, hoursAgo) → filtered articles`
- **book-parsing.json** — `parseBookRecommendations(markdown) → Book[]`
- **date-utilities.json** — `getMonthKey(date) → "YYYY-MM"`, `getCurrentQuarter() → "YYYY-QN"`
- **long-form-threshold.json** — `isLongForm(wordCount) → boolean`

### Tier 2: API Shape Contracts
These ensure both platforms send identical requests to external APIs:

- **prompts.json** — Default system/user prompts for daily summaries and book recommendations
- **anthropic-tools.json** — Tool definitions (`finalize_summary`, `finalize_recommendations`)
- **model-pricing.json** — Pricing per million tokens for each model

### Tier 3: Interface Contracts
These verify both platforms implement the same storage interface:

- **storage-interface.json** — Required method signatures and semantics

## Known Divergences (Flagged for Future Fixing)

These are documented differences between platforms that should eventually be aligned:

### ✅ 1. Book Recommendations Prompt — RESOLVED
- Both platforms now use: "Please recommend 5-8 books specifically about these topics..."

### ✅ 2. Book Recommendations User Prompt Template — RESOLVED
- Both platforms now use: `"Topics: {topics}"`

### 3. Book Model Structure — OPEN
- **Web (TS)**: `purchaseLinks: { amazon?: string, bookshop?: string }`
- **Swift**: `amazonLink?: String`, `bookshopLink?: String` (flat)
- **Canonical**: Web nested structure (`purchaseLinks.amazon`)
- **Resolution**: Swift should adopt nested structure or contract defines JSON shape

### 4. RSSFeedItem.pubDate Type — OPEN
- **Web (TS)**: `string?` (ISO 8601)
- **Swift**: `Date?`
- **Resolution**: Contract tests normalized output (both can parse correctly)

### ✅ 5. Missing Swift Storage Methods — RESOLVED
All four methods added to Swift's `StorageProtocol` and implementations:
- `logTopicActivity(topicId: string, topicName: string)`
- `getActiveTopicIdsForQuarter(quarter: string) → string[]`
- `getBookListByQuarterAndTopic(quarter: string, topicId: string) → BookList?`
- `getBookListsByQuarter(quarter: string) → BookList[]`

### ✅ 6. Storage Method Signature Mismatch — RESOLVED
- Swift now has `getBookListByQuarterAndTopic(quarter, topicId)` matching the web implementation

## TDD Workflow

For each contract:

1. **RED** — Write contract JSON with test cases
2. **RED** — Write TypeScript test that reads contract and verifies implementation
3. **GREEN** — Fix TypeScript implementation if needed (most should already pass)
4. **RED** — Write Swift test that reads same contract
5. **GREEN** — Fix Swift implementation or mark with `XCTExpectFailure` for known divergences
6. **REFACTOR** — Clean up while preserving native feel

## CI Enforcement

The `.github/workflows/test.yml` workflow runs:

1. **Contract validation** — Lint JSON files, check schema
2. **TypeScript contract tests** — `npm test` includes contract tests
3. **Swift contract tests** — `xcodebuild test` includes contract tests
4. **Coverage check** — Script verifies all contracts are tested on both platforms

## Adding New Contracts

When adding new business logic:

1. **Define the contract first** — Write JSON with expected behavior
2. **Write tests on both platforms** — Both read the same contract file
3. **Implement on both platforms** — Tests guide implementation
4. **Verify in CI** — Both platforms must pass before merging

## Benefits

- **Zero hosting cost** — No server needed, contracts are just JSON files
- **Open source friendly** — Contributors see exactly what behavior is expected
- **Prevents drift** — CI catches divergences immediately
- **Native feel preserved** — Each platform uses idiomatic code
- **Documentation** — Contracts serve as executable specifications

## Non-Goals

This system intentionally does NOT:

- Share code between platforms (no FFI, no code generation)
- Require runtime verification (tests run at CI time only)
- Mandate identical internal implementations (only outputs must match)
- Require a backend API (all logic stays client-side)

## Future Work

1. Fix known divergences (see list above)
2. Add contracts for RSS parsing edge cases
3. Add contracts for encryption/decryption (if deterministic)
4. Add contracts for article save limits (count vs word budget)
5. Consider contracts for UI state machines (if feasible)
