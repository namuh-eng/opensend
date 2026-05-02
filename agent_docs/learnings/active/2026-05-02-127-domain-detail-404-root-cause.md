---
date: 2026-05-02
issue: "#127"
type: mistake
promoted_to: null
---

## Don't wrap `notFound()` in a generic catch-all

**What:** `src/app/(dashboard)/domains/[id]/page.tsx` wrapped its Drizzle query
in `try { ... } catch { notFound() }`. Two distinct failure modes were both
collapsed to a 404:

1. The route param wasn't a UUID, so Postgres rejected the query with
   `invalid input syntax for type uuid` — and the catch swallowed it.
2. Any real DB error (connection drop, schema drift) was also masked as 404,
   so server logs never surfaced the actual failure.

The result: every `/domains/<id>` link rendered the global 404 page, even
though the row existed in the same connection used by the list page.

**Why it matters:** Server components should let infrastructure errors bubble
to Next.js so the framework can render an error boundary or 5xx response.
`notFound()` is for "the row doesn't exist," not "I couldn't find out
whether the row exists."

**Fix:** Validate the `[id]` segment with the existing `domainRouteParamsSchema`
before touching the DB, then run the query without a catch-all. Invalid UUIDs
produce a clean 404 without ever opening a Postgres transaction; missing
rows still 404; real DB errors propagate to Next.js' error handling.

**Pattern to reuse:** All other `[id]` server-component routes that import
`@/lib/validation/domains` (or the matching contact/email/template schemas)
should follow the same shape. The remaining detail pages
(`api-keys/[id]`, `emails/[id]`, `audience/contacts/[id]`,
`logs/[id]`, `templates/[id]`) still pass the raw param straight to a
`uuid` column — invalid UUIDs there will throw and either 500 or, if a
catch-all is present, mask the failure as 404. Worth filing follow-ups.
