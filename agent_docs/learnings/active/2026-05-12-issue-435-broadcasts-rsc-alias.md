---
date: 2026-05-12
issue: "#435"
type: decision
promoted_to: null
---

## Dashboard/root API alias collisions must recognize Next RSC requests

`GET /broadcasts` is both a dashboard page and a Resend-compatible collection
alias, so header detection must not treat `Accept: */*` alone as API intent.
Next browser/RSC navigations can include headers such as `RSC`,
`Next-Router-State-Tree`, and `Next-Url` while omitting `text/html`; those
requests should remain dashboard page requests.

For root GET aliases that collide with dashboard pages, require explicit API
signals such as `Authorization`, `Accept: application/json`, or JSON content
type before rewriting to `/api/*`. Keep mutation/detail aliases broader because
they do not occupy the dashboard list page route.
