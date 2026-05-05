---
date: 2026-05-05
issue: "#200"
type: decision
promoted_to: null
---

## Broadcast APIs require tenant-owned broadcast predicates

Broadcast list/create/detail/update/delete/send/metrics now resolve a concrete caller `userId` from API-key or dashboard auth, reject requests without one, stamp new broadcasts with that user, and include `broadcasts.user_id` in every ownership read and mutation. Broadcast metrics also verifies broadcast ownership before reading/writing cache, scopes email aggregation by `emails.user_id`, and includes user id in the broadcast metrics cache key.

A real Postgres scenario exposed that the JSONB tag containment predicate must bind a JSON string cast to `jsonb`; passing a JavaScript array directly through Drizzle returned zero matches even for matching tags.
