---
date: 2026-05-08
issue: "#253"
type: decision
promoted_to: null
---

## Resend sandbox recipients are accepted by API and simulated by the worker

Sandbox detection is shared from `@opensend/core`, but accepted delivered/bounced/complained sends still persist ordinary queued email rows and publish `email.send`. The queue worker owns the SES-avoidance boundary: if all `to` recipients are the same Resend sandbox outcome, it records durable sent/delivered/bounced/complained events, refreshes bounce/complaint suppressions, and enqueues lifecycle webhooks without calling the provider.

`suppressed@resend.dev` is API-level only for this slice: it returns the existing public `recipient_suppressed` envelope before quota, row creation, or queueing. That keeps suppression behavior aligned with send-time suppression rejection instead of inventing a new suppression-list reason.
