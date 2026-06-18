---
date: 2026-06-18
issue: 656
type: pattern
promoted_to: null
---

# Overage reporting needs a claimed cursor, not only a reported cursor

When sends can continue past quota, Stripe metered reporting must prevent overlapping report ranges under concurrent scheduler runs. A durable outbox row keyed by an exact range is not enough by itself: one worker can claim `1-250`, new sends can arrive, and another worker can independently claim `1-251` unless the usage period has a separate claimed cursor or a per-period lock.

Pattern used for issue #656:
- `usage_periods.overage_reported_emails` records the confirmed Stripe reporting cursor.
- `usage_periods.overage_claimed_emails` records the highest overage email count already assigned to an outbox report.
- `billing_overage_reports` stores the durable Stripe meter event identity and retry status.
- The reporter reuses pending/failed/stale sending reports first, then locks the usage period row and advances `overage_claimed_emails` before inserting a new report.

This keeps new reports non-overlapping while still allowing failed reports to retry with the same Stripe identifier/idempotency key.
