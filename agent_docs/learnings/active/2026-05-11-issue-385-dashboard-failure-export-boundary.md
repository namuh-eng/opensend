---
date: 2026-05-11
issue: "#385"
type: decision
promoted_to: null
---

## Dashboard delivery-failure exports stay off the public email API

Issue #385 adds a dashboard CSV export for bounced, complained, and suppressed failures. Keep this on a dashboard-only session-auth route instead of widening `/api/emails`, because `/api/emails` is the public Resend-compatible surface and intentionally requires API-key auth.

The export combines `emails` rows for `bounced`/`complained` with `email_suppressions` rows for `suppressed`, all scoped by `user_id`. Suppression rows provide the durable source email/message identifiers when SES bounce/complaint events have refreshed suppression metadata.
