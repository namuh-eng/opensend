---
date: 2026-05-02
issue: 136
type: decision
promoted_to: null
---

## Quota reservations belong in the accept transaction

**What:** Email quota gating reserves `usage_periods.emails_sent` with a single conditional `UPDATE ... WHERE emails_sent + N <= limit` and the send routes pass the Drizzle transaction into the quota service before inserting accepted email rows.

**Why:** This keeps concurrent quota checks on the database row instead of an app-level read-then-write window, while preserving the existing post-commit SQS publish boundary so workers only see durable email rows.

**Caveat:** Unit-test doubles assert the conditional update path but do not provide real Postgres row locking; production correctness depends on Postgres row update locking for the `usage_periods` row.
