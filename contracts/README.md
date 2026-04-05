# Behavioral Contracts

This directory contains JSON specification files that define expected behavior for business logic shared across all MTN client platforms (web, macOS, iOS).

## Purpose

Since MTN clients are written in different languages (TypeScript for web, Swift for Apple platforms), we can't share code directly. Instead, we share **behavioral contracts** — test specifications that both platforms must pass.

## Contract Files

| File | Purpose | Tested By |
|------|---------|-----------|
| `prompts.json` | Default AI prompts (must be identical across platforms) | `contracts.test.ts`, `ContractTests.swift` |
| `anthropic-tools.json` | Tool definitions sent to Anthropic API | `contracts.test.ts`, `ContractTests.swift` |
| `word-counting.json` | Text → word count test cases | `contracts.test.ts`, `ContractTests.swift` |
| `date-filtering.json` | Article date filtering logic | `contracts.test.ts`, `ContractTests.swift` |
| `book-parsing.json` | Markdown → Book[] parsing | `contracts.test.ts`, `ContractTests.swift` |
| `date-utilities.json` | Date → quarter/month string formatting | `contracts.test.ts`, `ContractTests.swift` |
| `long-form-threshold.json` | Word count → isLongForm boolean | `contracts.test.ts`, `ContractTests.swift` |
| `model-pricing.json` | Model → pricing per million tokens | `contracts.test.ts`, `ContractTests.swift` |
| `storage-interface.json` | Required storage method signatures | `contracts.test.ts`, `ContractTests.swift` |

## How It Works

1. **Define behavior** — Write a JSON file with input/output test cases
2. **Test TypeScript** — `src/services/__tests__/contracts.test.ts` reads the JSON and verifies the TS implementation
3. **Test Swift** — `apple/MTNTests/ContractTests.swift` reads the same JSON and verifies the Swift implementation
4. **CI enforcement** — Both test suites must pass before merging

## Example Contract

```json
{
  "description": "Word counting must handle HTML tags and whitespace consistently",
  "cases": [
    {
      "input": "Hello world",
      "expectedWordCount": 2
    },
    {
      "input": "<p>Hello</p> <p>world</p>",
      "expectedWordCount": 2
    },
    {
      "input": "  multiple   spaces   here  ",
      "expectedWordCount": 3
    }
  ]
}
```

## Adding New Contracts

When adding new business logic:

1. **Write the contract first** — Define expected behavior in JSON
2. **Write tests** — Both `contracts.test.ts` and `ContractTests.swift` should read the new contract
3. **Implement** — Make both platforms pass the tests
4. **Document** — Update this README with the new contract file

## Known Divergences

See `CONTRACTS.md` in the repo root for a list of known differences between platforms that are flagged for future fixing.
