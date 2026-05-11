---
date: 2026-05-12
issue: "#406"
type: pattern
promoted_to: null
---

## Manual audience add must follow current list/create API contracts

The Audience manual-add modal is a dashboard client of the real `/api/segments` and `/api/contacts` routes. `/api/segments` returns the public list envelope (`{ object, data, has_more, total }`), not a raw segment array, and `/api/contacts` creates one contact per request with `{ email, segments }`, not the legacy UI shape `{ emails, segment_ids }`.

Future dashboard contact-add changes should normalize list envelopes at the UI boundary and submit the same single-contact payload the route validates, then prove the path with an auth-backed Playwright test against a real database row instead of route-only mocks.
