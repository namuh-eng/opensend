---
date: 2026-05-07
issue: "#235"
type: decision
promoted_to: null
---

## Provider retry visibility is persisted on emails, terminal outcomes in events

Queue/SQS still owns redelivery timing, but provider send failures now copy SQS receive count and deterministic retry delay into `emails.provider_*` columns so list/detail APIs can explain queued provider-degraded sends. When the configured provider attempt ceiling is reached, the worker marks the email `failed`, clears `provider_next_retry_at`, sets `provider_dead_lettered_at`, records a `failed` email event, and returns success to delete the SQS message instead of relying on an invisible AWS DLQ-only outcome.
