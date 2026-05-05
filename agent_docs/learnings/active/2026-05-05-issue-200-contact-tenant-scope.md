---
date: 2026-05-05
issue: "#200"
type: decision
promoted_to: null
---

## Contacts API rejects unowned/unknown-user access

Contact route tenant isolation now treats a resolved caller `userId` as mandatory: API-key flows without `userId` return 401, dashboard-capable contact list/create resolves the Better Auth session user, and contact/segment/topic mutations include `contacts.user_id` predicates. Segment and topic lookups inside contact flows are also scoped to the same user.

This is intentionally slice-only: it does not change the global contacts email unique index, does not add null-owned historical fallback, and does not broaden into emails/broadcasts/webhooks.
