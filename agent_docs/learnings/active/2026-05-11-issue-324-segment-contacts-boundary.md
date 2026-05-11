---
date: 2026-05-11
issue: "#324"
type: pattern
promoted_to: null
---

## Segment contact listing belongs with audience metadata, not contacts CRUD

**What:** `/api/segments/[id]/contacts` is part of the public audience taxonomy family even though it returns contact rows. Its compatibility contract is API-key-only detail auth, full-access permission gating, tenant-scoped segment existence check before listing, and the legacy list shape `{ object, data, has_more }` with `firstName`/`lastName` camel-case fields.

**Why:** Treating it as generic contacts CRUD risks broadening issue #324 into contact mutation/list refactors and can accidentally change dashboard-capable auth rules used by collection segment/topic/property routes.

**Fix:** Keep the Next route as an API-key auth/parse/HTTP adapter and place the tenant-scoped segment-contact join under the audience metadata service/repository boundary. Future changes should preserve the route family's auth split: collection routes may use dashboard-or-API-key auth, while `[id]` detail-family routes remain API-key-only.
