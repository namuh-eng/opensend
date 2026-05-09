---
date: 2026-05-08
issue: "#279"
type: decision
promoted_to: null
---

## Keep send orchestration in shared request handlers before deeper core extraction

Issue #279 moves `POST /emails` and `POST /emails/batch` into `services/api` by extracting the existing Next.js orchestration into shared handlers under `src/lib/api/emails/`. The Hono service and the Next compatibility routes both call those handlers, preserving current auth, validation, idempotency, quota, queue, telemetry, response, and error behavior without a public API shape change.

A deeper `packages/core` extraction is still desirable, but doing it in the same slice would force many app-only seams (public error envelopes, API request logs, unsubscribe URL construction, quota transactions, attachment normalization, and template lookup) across package boundaries at once. Future send-route refactors should move those dependencies behind injectable core services one seam at a time.
