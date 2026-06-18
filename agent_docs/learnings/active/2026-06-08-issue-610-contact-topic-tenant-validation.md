---
date: 2026-06-08
issue: "#610"
type: pattern
promoted_to: null
---

## Contact topic relationship updates must resolve every topic by tenant

Root contact relationship aliases reuse the canonical `/api/contacts/**` handlers, but real API-key E2E coverage for issue #610 exposed that `PATCH /contacts/{contact_id}/topics` could write arbitrary topic IDs unless the service resolved each requested topic through `findTopicByIdForUser` first.

Future contact relationship changes should prove topic preference updates with tenant A/B API keys, not just route mocks. Treat a missing or cross-tenant topic ID as `404 Topic not found` before writing `contacts.topic_subscriptions`.
