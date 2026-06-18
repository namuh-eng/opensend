---
date: 2026-05-28
issue: 556
type: decision
promoted_to: null
---

# Suppressions dashboard bulk slice stays synchronous and source-linked

Issue #556 implements the dashboard/API compatibility slice without building the separate async export center. CSV import is all-or-nothing, limited to 200 rows and 64 KiB; CSV export is immediate, tenant-scoped, sanitized against spreadsheet formula injection, and capped at 1,000 rows.

Domain/topic filters intentionally use only existing source email evidence (`email_suppressions.source_email_id -> emails.from/topic_id`). Manual/API/import suppressions do not invent domain or topic dimensions, so docs and UI label those filters as source-email-only.
