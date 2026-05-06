---
date: 2026-05-07
issue: "#224"
type: decision
promoted_to: null
---

## API request logs use sanitized JSONB metadata, not new relational columns

Issue #224 links accepted email sends back to request logs through `logs.document.emailId` / `logs.document.emailIds` while keeping first-class tenant predicates on `logs.user_id` and `logs.api_key_id`. This avoids a migration for the first parity slice and lets email detail join associated request logs with a bounded JSONB predicate.

Sanitization deliberately redacts bearer/cookie/token/password-like fields plus large message body fields (`html`, `text`, attachment `content`) before persistence. API key UUIDs remain visible as `apiKeyId`; raw API keys and authorization headers must never be persisted.
