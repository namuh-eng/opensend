---
date: 2026-05-11
issue: "#422"
type: pattern
promoted_to: null
---

## Preserve route-specific billing DTO shapes when extracting shared services

The public plans list and billing summary both expose plan-like objects, but their HTTP shapes are not identical: `/api/billing/plans` list items include `object: "plan"`, while `/api/billing/summary` embeds plan fields without an `object` discriminator. Billing service boundaries should use separate mappers for list-plan DTOs and summary-plan DTOs instead of reusing the public list item mapper everywhere.
