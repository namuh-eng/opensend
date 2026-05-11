---
date: 2026-05-11
issue: "#402"
type: pattern
promoted_to: null
---

## Broadcast dashboard list should not rely solely on first client fetch

Production dogfood showed `/broadcasts` could render the dashboard shell and stay on `Loading broadcasts...` without an observed `/api/*` request. The list now follows the safer dashboard pattern used by other pages: the server page resolves the dashboard session, loads tenant-scoped initial broadcasts via `createBroadcastService`, and passes the result into the client list so empty accounts render `No broadcasts` immediately.

Keep client fetching for filter/search retries, but skip the redundant first list fetch when server initial data or a server load error is present. Client fetch failures should render a visible retryable error state rather than falling through to an indefinite loading message or silently pretending the list is empty.
