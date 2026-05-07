---
date: 2026-05-07
issue: "#229"
type: decision
promoted_to: null
---

## Dashboard E2E auth must be real Better Auth rows plus a signed cookie

Playwright route mocks for `/api/auth/get-session` only affect browser fetches;
they do not authenticate server components or app routes that call
`getServerSession()`. Dashboard E2E specs should use the shared auth fixture in
`tests/e2e/fixtures/auth.ts`, which inserts a real Better Auth `user` and
`session`, signs `better-auth.session_token` with the Better Auth secret, and
adds that cookie to the browser context before navigation.

When an E2E path can call SES, run with an isolated HOME that has no AWS
credentials so local development uses the SES stub instead of creating real SES
identities.
