---
date: 2026-05-10
issue: "#313"
type: pattern
promoted_to: null
---

## Contacts boundary owns legacy segment sync until storage is migrated

**What:** The contacts service boundary now keeps contact CRUD and contact↔segment association rules in `packages/core`, including the transitional dual-write between `contacts_to_segments` and the legacy `contacts.segments` JSON name array.

**Why:** Existing API responses and dashboard filters still read segment names from `contacts.segments`, while newer association routes also maintain `contacts_to_segments`. Moving only the route adapter without preserving that legacy sync would silently break list filtering and contact segment reads.

**Fix:** For future contacts/segments boundary slices, treat join-table writes and legacy JSON segment-name updates as one service-owned business rule until the public read paths are migrated off `contacts.segments`. Also keep `packages/core/src/db/schema.ts` synchronized with app schema additions needed by core repositories.
