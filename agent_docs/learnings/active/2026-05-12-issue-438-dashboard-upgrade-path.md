---
date: 2026-05-12
issue: "#438"
type: decision
promoted_to: null
---

## Dashboard Usage upgrades should enter the authenticated billing plan picker

Issue #438 fixes the signed-in upgrade loop by linking Settings → Usage upgrade affordances directly to `/settings/billing/plans`, reusing the existing auth-gated `PricingGrid` that posts to `/api/billing/checkout`. Keep public `/pricing` CTAs pointed at `/auth` for logged-out marketing traffic instead of making the landing page auth-aware.

When billing is disabled, keep Usage rendering disabled "Upgrade unavailable" controls rather than linking to the billing plan picker; `/settings/billing/plans` remains unavailable for self-host/default deployments.
