---
date: 2026-05-04
issue: 179
type: pattern
promoted_to: null
---

# Webhook service extraction

Extract webhook route business logic into `packages/core/src/services/webhook.ts` using the domains service factory pattern: injectable repository plus injectable signing-secret generator, core-level status/field mapping, and thin Next adapters for auth, parse/validation, service invocation, and HTTP response mapping.

Route tests that mock `@opensend/core` should avoid `importOriginal` for the whole package; importing the real core module inside every route-smoke test adds enough overhead to trip the 5s Vitest timeout in the large route smoke file.
