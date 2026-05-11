# Playwright E2E testing standards

Issue #229 sets the E2E bar for future agent work: prove behavior through the
real app boundary whenever possible, and label narrower smoke/mocked tests so
reviewers do not mistake them for full end-to-end coverage.

## Decision tree

1. **Vitest unit tests** — use for pure functions, schema validation, DTO
   mapping, repository/service branching with injected dependencies, and fast
   edge-case matrices. Do not use Vitest alone to claim a browser, auth, route,
   or database workflow works end-to-end.
2. **Playwright API request tests** — use when the product contract is an app
   route or public API. These tests should call `request`/`APIRequestContext`
   against the running Next app and use real Postgres rows for auth, tenants,
   API keys, and seeded data. This is the default for tenant isolation and route
   authorization regressions.
3. **Playwright browser UI tests** — use when the claim includes rendered UI,
   navigation, forms, server components, cookies, or browser-visible behavior.
   Use the real Better Auth session fixture for authenticated dashboard pages.
4. **Mocked smoke/integration tests** — allowed only for UI component flows that
   would otherwise require external providers or unfinished backend contracts.
   Keep route mocks local to the spec, state that the test is mocked/smoke in
   the title or classification table below, and do not cite it as proof of real
   API/database behavior.

Do not make every UI test hit SES, Stripe, Cloudflare, S3, or other real
external services. Prefer sandbox/dev stubs at the app boundary and reserve real
external-provider coverage for explicitly scoped scenarios.

## Shared fixtures and helpers

Import from `./fixtures/auth` for tests that need real auth, tenants, API keys,
or deterministic cleanup:

```ts
import { expect, test } from "./fixtures/auth";

test("dashboard flow", async ({ authenticatedPage, e2eUser, e2eDb }) => {
  await authenticatedPage.goto("/domains");
  await expect(authenticatedPage.getByRole("heading", { name: "Domains" })).toBeVisible();

  const { rows } = await e2eDb.query("select id from domains where user_id = $1", [
    e2eUser.id,
  ]);
  expect(rows).toBeDefined();
});

test("API route flow", async ({ e2eApiRequest }) => {
  const response = await e2eApiRequest.get("/api/contacts");
  expect(response.status()).toBe(200);
});
```

The fixture provides:

- `e2eDb` — a real `pg` client connected through `DATABASE_URL`.
- `e2eRunId` — a deterministic marker derived from the Playwright test title,
  worker, retry, and parallel index, or from `E2E_RUN_ID` when provided.
- `createE2EUser(client, runId, suffix)` — inserts a Better Auth `user` and
  `session` row.
- `authenticatedPage` — adds a signed `better-auth.session_token` cookie for a
  real session; this is the canonical dashboard auth path. Client-side mocks of
  `/api/auth/get-session` do **not** authenticate server components or app
  routes that call `getServerSession()`.
- `createE2EApiKey(client, runId, userId, suffix)` — inserts a full-access API
  key with a deterministic raw token and hash.
- `createE2ETenant(client, runId, suffix)` — creates a user plus API key for
  multi-tenant API-route tests.
- `e2eTenant` and `e2eApiRequest` — a default tenant and API request context
  with the tenant's bearer token.
- `cleanupE2ERun(client, runId)` — deletes rows owned by the deterministic test
  users/API keys and contact rows marked with the run id. Call it in `finally`
  when a spec creates extra tenants or app data.

## Database and cleanup rules

- Every DB-backed E2E test must skip with a clear reason when `DATABASE_URL` is
  missing.
- Use deterministic emails like `name@${e2eRunId}.e2e.opensend.test` and store
  `{ test_run_id: e2eRunId }` in `document`/properties when the table supports
  it.
- Clean before and after by `e2eRunId`. Avoid data-dependent no-op assertions;
  assert exact IDs or exact status codes.
- Avoid brittle sleeps. Prefer URL assertions, locator assertions, route/API
  responses, or DB polling tied to a concrete condition.
- For SES-touching scenarios, run with an isolated `HOME` that has no AWS
  credentials so local development uses the SES dev stub instead of creating
  real SES identities.

## Current E2E classification audit

| Spec | Classification | Notes |
| --- | --- | --- |
| `tenant-isolation.spec.ts`, `audiences-api.spec.ts` | Real Playwright API E2E | Canonical issue #229 proof for contacts plus issue #360 proof for Resend-compatible `/audiences` CRUD backed by Postgres segment rows. |
| `domain-create-auth.spec.ts` | Real browser E2E | Uses `authenticatedPage`, real Better Auth rows, dashboard UI, and Postgres domain assertion. |
| `domains-page.spec.ts` | Real browser E2E | Uses `authenticatedPage`; mostly page rendering/navigation over current DB state. |
| `landing-page.spec.ts` | Real browser E2E | Public landing page plus signed-in redirect through real auth fixture. |
| `logs-search.spec.ts` | Real browser/API-backed E2E | Requires `DATABASE_URL`; seeds dashboard log data. |
| `unsubscribe.spec.ts` | Real public route E2E | Uses real Postgres contact row for success path; invalid-token path is public-route smoke. |
| `emails-alias.spec.ts`, `openapi.spec.ts` | Real API smoke | Calls real app routes, but negative/static assertions only; not a full domain workflow proof. |
| `billing-checkout.spec.ts`, `billing-page.spec.ts` | Mixed smoke/mocked integration | Negative API assertions are real route smoke; checkout UI uses route mocks for Stripe-dependent flow. |
| `automations-dashboard.spec.ts`, `sidebar-logout.spec.ts` | Mocked browser integration | Route-mocks auth/API responses; useful UI coverage but not server auth or DB proof. |
| Broadcast/template editor/list specs | API-assisted UI smoke | Create data through page request and exercise UI, but currently depend on legacy request auth assumptions; treat as smoke until migrated to shared fixtures. |
| Remaining component/page specs | Browser smoke | Primarily render/navigation/interaction checks; use them for UI regressions, not tenant/auth/data-isolation proof. |

When adding or changing a spec, update this table if its proof level changes.

## Running E2E tests

`make test-e2e` runs `bun run test:e2e`, which starts `bun run dev` on port
`3015` through `playwright.config.ts` unless a server already exists.

Prerequisites for DB/auth-backed specs:

1. Install dependencies with Bun.
2. Start or provide Postgres and set `DATABASE_URL`.
3. Apply migrations: `bun run db:migrate` (or use `docker compose up -d`, whose
   migrator service applies migrations for the compose database).
4. Set `BETTER_AUTH_SECRET` consistently when overriding the local default.
5. Optional: set `E2E_RUN_ID=<short-id>` to group cleanup for a local run.

Targeted examples:

```bash
bunx playwright test tests/e2e/tenant-isolation.spec.ts
bunx playwright test tests/e2e/domain-create-auth.spec.ts
```
