---
date: 2026-05-11
issue: "#391"
type: decision
promoted_to: null
---

## Email detail trace shares a bounded provider-payload sanitizer

Issue #391 adds dashboard event trace details without rendering raw
`email_events.payload`. The shared mapper lives in
`packages/core/src/services/emailEventTrace.ts` so `EmailLifecycleService` and
the dashboard use the same event id/type/order/detail semantics while the legacy
API event payload remains present for compatibility.

Future trace fields should be added as explicit allowlisted extracts with small
string/array bounds. Do not render generic payload JSON in the dashboard: auth
headers, body/html/text, cookies, tokens, and provider payload drift can expose
too much context.
