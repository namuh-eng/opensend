---
date: 2026-05-07
issue: "#200"
type: mistake
promoted_to: null
---

## Tenant-scope audits must include nested action/detail routes

Issue #200 follow-up found tenant predicates missing outside the main CRUD routes: email cancel, email attachment list/detail, public logs list/detail, and the dashboard contact detail page. These routes looked adjacent to already-scoped email/contact/log work, but still needed explicit `auth.userId` or dashboard session predicates.

For future tenant-isolation sweeps, search by resource table usage (`emails`, `logs`, `contacts`) across nested route directories and dashboard detail pages, not only top-level API route files. Cross-tenant regression tests should assert both 404 detail/mutation behavior and empty list behavior.
