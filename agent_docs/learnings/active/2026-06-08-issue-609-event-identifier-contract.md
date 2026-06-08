---
date: 2026-06-08
issue: "#609"
type: decision
promoted_to: null
---

## Root custom event detail routes accept ID or exact event name

Issue #609 needed a stable path identifier for `/events/{identifier}`. The implementation resolves the identifier within the authenticated tenant by event ID first, then by exact event name. This keeps UUID IDs stable, supports strict clients that address custom events by name, and preserves tenant-isolated 404 behavior for detail/update/delete.

The legacy collection delete shape `DELETE /api/events?id=...` remains supported for existing callers and continues to use the event ID query parameter.
