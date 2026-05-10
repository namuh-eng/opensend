---
date: 2026-05-11
issue: "#334"
type: pattern
promoted_to: null
---

## Boundary extractions must update cross-route smoke mocks, not only focused route tests

When moving broadcast send/metrics logic behind `createBroadcastService()`, focused broadcast tests passed but `tests/api-auth-date-range-routes.test.ts` still mocked `@opensend/core` with the older CRUD-only service surface. Service-boundary PRs should update shared smoke-test mocks for every new service method the route adapter calls, or full `make test` can fail even when the focused route tests pass.
