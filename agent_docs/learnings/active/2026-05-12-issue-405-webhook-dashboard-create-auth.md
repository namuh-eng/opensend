---
date: 2026-05-12
issue: "#405"
type: decision
promoted_to: null
---

## Dashboard webhook create uses the shared API route

The `/webhooks` dashboard create flow should POST to the existing `/api/webhooks` handler rather than adding a dashboard-only insert path. That route must accept authenticated dashboard sessions in addition to full-access API keys, resolve the caller's tenant id through the shared audit context, and keep sending-access API keys forbidden.

Why: the dashboard can then exercise the same validation, signing-secret generation, audit event, service, and tenant-scoped repository path as public API callers. Regression proof should include a real Playwright flow that signs in through the Better Auth fixture, creates the endpoint through the route, and verifies the persisted `webhooks.user_id` row.
