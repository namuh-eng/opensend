---
date: 2026-05-11
issue: 369
type: decision
promoted_to: null
---

## Usage tab limits must come from billing when billing is enabled

Settings `/api/usage` still uses the dashboard aggregate service for dashboard counters, but when Stripe billing is enabled the route adapter enriches the payload from `loadBillingSummary(userId)`. That makes the Usage tab's plan label, monthly email quota, domain usage count, and domain limit match the active billing plan source of truth.

The aggregate-service fallback now uses `FREE_PLAN_DEFAULTS` exported from core DTOs instead of duplicating Free plan literals. Keep future dashboard fallback limits tied to the same defaults used by `planRepo.ensureFreePlan()` and billing quota fallback creation so the disabled/missing-billing path cannot drift independently.
