---
date: 2026-06-07
issue: deliverability-provider-feedback
type: pattern
promoted_to: null
---

## Treat deliverability as provider feedback, not email status

**What:** Today and Metrics deliverability values must be backed by `email_events` rows created from SES/SNS provider feedback. Email row statuses are queue/provider-send state and should not be used as a proxy for delivery/open/click rates.

**Why:** Production can successfully mark an email `sent` while the domain row has no SES configuration set, no SNS event destination, or no trusted email-id carrier. In that state the dashboard should show provider feedback as not wired instead of showing misleading zeros.

**Pattern:** For production repair, run `bun run deliverability:preflight` first, then `--repair` after IAM and `SES_EVENTS_SNS_TOPIC_ARN` are configured. Validate DB write-back, SES `opensend-sns-events`, trusted `X-Entity-ID`/message-tag correlation, user-scoped `email_events`, and dashboard state together.
