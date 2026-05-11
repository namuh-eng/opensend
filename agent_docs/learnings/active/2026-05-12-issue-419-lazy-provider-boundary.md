---
date: 2026-05-12
issue: "#419"
type: pattern
promoted_to: null
---

## Billing route service boundaries should keep provider creation lazy

When extracting checkout/portal orchestration behind `createBillingSessionService()`, the Stripe client dependency stays lazy in the default factory so invalid checkout requests still short-circuit before touching Stripe. This preserves the old route order: billing flag/session/body validation, public plan lookup, and price/customer checks happen before provider calls where applicable.

For future provider-backed route extractions, inject provider factories rather than eagerly-created clients when existing behavior depends on early 400/404 responses not initializing external SDKs.
