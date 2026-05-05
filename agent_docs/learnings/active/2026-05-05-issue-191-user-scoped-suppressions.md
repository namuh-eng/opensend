---
date: 2026-05-05
issue: 191
type: decision
promoted_to: null
---

# User-scoped suppression list first slice

Issue #191 implements suppression records keyed by `(user_id, email)` rather than global/provider scope. SES hard-bounce (`Bounce` with `bounceType: Permanent`) and complaint notifications refresh the row from the ingester after the email event is created; exact SNS redeliveries remain idempotent through `email_events.source_id`, so suppression refresh only runs on newly-created event rows.

Send acceptance checks only `to` recipients before quota reservation and email-row insertion. Single sends return the stable `recipient_suppressed` public error; batch sends preserve input order and return per-item `{ error }` entries for suppressed items while quota/queueing only accepted items.
