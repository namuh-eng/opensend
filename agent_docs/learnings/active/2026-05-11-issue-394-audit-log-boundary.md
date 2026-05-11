---
date: 2026-05-11
issue: "#394"
type: pattern
promoted_to: null
---

## Account audit logs stay separate from request logs

**What:** Issue #394 adds a dedicated `audit_events` table plus dashboard `/audit-log` view for account/security mutations. Existing `logs` remain request-troubleshooting records.
**Why:** API request logs can include request/response debugging metadata and should not be overloaded as the durable compliance trail for who changed API keys, domains, or webhooks.
**Fix:** New security-sensitive mutation paths should call the audit helper after successful mutation, include actor/source/target/action fields, and keep metadata allowlisted or passed through the audit sanitizer so API keys, tokens, signing secrets, cookies, auth headers, and content bodies are never persisted.
