---
date: 2026-05-05
issue: "#200"
type: decision
promoted_to: null
---

## Public webhook/API-key routes require caller-owned predicates

Webhook API list/create/detail/update/delete now require a resolved API-key `userId`, stamp new webhook rows with that user, and pass `userId` through the service/repository layer so public CRUD predicates include `webhooks.user_id`. API-key list/get/delete similarly require a resolved owner and pass `userId` through service/repository calls, so delete invalidates cache only after finding an owned key.

Webhook dispatch still needs service-owned lookup of subscribed hooks after SES ingestion, so the repository exposes explicit `findByIdForDispatch`/`listForDispatch` helpers for that worker path instead of letting public route operations fall back to unscoped reads.
