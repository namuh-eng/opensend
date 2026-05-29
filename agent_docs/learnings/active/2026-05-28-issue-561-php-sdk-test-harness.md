---
date: 2026-05-28
issue: "#561"
type: pattern
promoted_to: null
---

## Validate SDK request plumbing against a local HTTP fixture server

**What:** The PHP SDK tests start PHP's built-in HTTP server with a tiny router fixture, record real HTTP requests, and serve configurable JSON/error responses.

**Why:** SDK request construction, idempotency headers, response parsing, and error-envelope mapping can be verified without real OpenSend credentials while still exercising the actual stream HTTP transport instead of a mocked transport.

**Pattern:** Keep Composer `vendor/`, `.phpunit.cache/`, and generated `composer.lock` ignored/removed before repo-wide Biome checks because the monorepo lint command scans files on disk, not just tracked files.
