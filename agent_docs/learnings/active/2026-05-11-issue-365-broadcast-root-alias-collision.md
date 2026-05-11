---
date: 2026-05-11
issue: "#365"
type: decision
promoted_to: null
---

## Broadcast collection root aliases must preserve the dashboard page

Next.js cannot build both `src/app/broadcasts/route.ts` and the dashboard page at `src/app/(dashboard)/broadcasts/page.tsx`; the route/page conflict fails `next build` at `/broadcasts`.

For Resend-compatible collection aliases that collide with dashboard pages, keep `GET/POST /broadcasts` as API-like middleware rewrites to `/api/broadcasts` and gate `GET /broadcasts` by API-like headers (`Authorization`, JSON content/accept, or non-HTML clients). Browser HTML navigations should continue through the dashboard session flow.

Detail aliases such as `/broadcasts/[id]` and `/broadcasts/[id]/send` can remain App Router route handlers because they do not occupy the dashboard list page path.
