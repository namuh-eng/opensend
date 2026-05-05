---
date: 2026-05-06
issue: "#200"
type: decision
promoted_to: null
---

## Webhook and API-key management requires caller user scope

Webhook and API-key management routes now reject authenticated API keys that do not resolve to a concrete `userId`. Route calls pass that `userId` through service and repository boundaries for list/get/update/delete operations, and create paths stamp new webhooks/API keys with the caller user.

API-key deletion first looks up the key with the owner predicate and only invalidates the auth cache for an owned key, preventing cross-tenant cache invalidation or deletion by guessed id.
