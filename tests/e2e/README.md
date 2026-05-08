# E2E testing standards

Issue #229 makes Playwright coverage the close-loop proof for behavior that must
work through the real app boundary. Unit tests remain the fast regression layer;
Playwright proves real HTTP/browser behavior.

## Decision tree

- **Vitest unit tests**: pure functions, validators, repositories, DTOs, and
  route predicates where an isolated fast check gives useful edge-case coverage.
- **Playwright API route E2E**: real HTTP behavior, auth headers, API-key
  permissions, tenant isolation, response envelopes, pagination, and status
  codes. Use `request` against Next.js routes and real Postgres rows.
- **Playwright browser E2E**: session cookies, server-rendered dashboard pages,
  navigation, forms, and UI behavior. Dashboard tests must use the real Better
  Auth fixture, not a route mock.
- **Mocked browser integration**: allowed only for provider/client-state flows
  where backend correctness is explicitly not under test. File comments and this
  audit must say that the test is not backend proof.
- **Smoke-only tests**: allowed for legacy or fixture-missing UI checks, but they
  cannot support correctness, auth, tenant, or security claims. If they require
  seed data, they must skip explicitly with the missing prerequisite.

## Authenticated dashboard tests

Use the real Better Auth fixture instead of mocking `/api/auth/get-session`:

```ts
import { expect, test } from "./fixtures/auth";

test("dashboard flow", async ({ authenticatedPage, e2eUser, e2eDb }) => {
  await authenticatedPage.goto("/domains");
  await expect(authenticatedPage.getByRole("heading", { name: "Domains" })).toBeVisible();
});
```

The fixture creates real Postgres `user` + `session` rows, signs the
`better-auth.session_token` cookie the same way Better Auth expects, adds it to
the browser context, and removes auth plus common tenant-owned rows after the
test.

## Shared fixtures/helpers

`tests/e2e/fixtures/auth.ts` exports:

- `authenticatedPage` — browser page with a signed Better Auth session cookie.
- `e2eDb` — connected `pg` client for deterministic setup/assertion/cleanup.
- `e2eRun` — per-test run id and email prefix.
- `e2eUser` — single authenticated user convenience fixture.
- `e2eTenantA` / `e2eTenantB` — two real users for tenant-isolation scenarios.
- `createE2EUser` / `cleanupE2EUser` — explicit auth row setup/teardown.
- `createE2EApiKey` / `cleanupE2EApiKey` — real API key rows with SHA-256 token
  hashes compatible with `validateApiKey()`.
- `cleanupE2EContactsByEmailPrefix` / `countE2ERowsByPrefix` — exact-prefix
  cleanup helpers for contact scenarios.

## Cleanup contract

- Use `e2eRun.emailPrefix` or exact returned IDs for every row created by a
  Playwright test.
- Clean app rows in `finally` before user teardown when the test creates records
  outside the built-in fixture cleanup.
- Do not delete by broad patterns that could match developer data.
- Security/tenant tests should include a post-cleanup assertion when practical.

## Provider-gated and external-service tests

`make test-e2e` must exit green from the documented local setup. Tests that need
external credentials or optional provider state must either:

1. pass without real external credentials by using the local/stubbed path, or
2. call `test.skip(...)` with a named env/prerequisite reason and list that
   prerequisite in the audit table below.

Examples: live Stripe checkout requires explicit billing env; domain creation
requires `DKIM_ENCRYPTION_KEY` because the route generates DKIM key material.

## Clean local setup

```bash
cp .env.example .env     # if needed
make setup               # starts Postgres, pushes schema, seeds sample data
make test-e2e            # sources .env, starts Next via Playwright webServer
```

If the database already exists but schema is stale, run:

```bash
set -a; . ./.env; set +a; bun run db:push
make test-e2e
```

For SES-touching scenarios, run with a `HOME` that does not contain AWS
credentials unless the test explicitly targets live SES.

## Feature PR proof shape

For auth, tenant, security, API, or persistence-sensitive changes, the closing
Playwright proof should:

1. create deterministic real data via the fixtures/helpers;
2. exercise the app from outside through browser or HTTP;
3. assert observable response/UI behavior;
4. assert persisted DB state where relevant;
5. clean all test-owned rows;
6. state whether the test is real browser E2E, API route E2E, mocked browser
   integration, provider-gated, or smoke-only.

## Complete E2E audit

| File | Category | Confidence / prerequisites | #229 action | Follow-up |
| --- | --- | --- | --- | --- |
| `add-contact-modal.spec.ts` | Real browser E2E | Real auth/session; creates contacts under fixture user. | Migrated to `authenticatedPage`; user teardown removes contacts. | None. |
| `api-code-drawer.spec.ts` | Real browser UI E2E | Real auth/session; no backend correctness claim. | Migrated to `authenticatedPage`. | None. |
| `api-key-detail.spec.ts` | Smoke-only skipped | Needs deterministic dashboard API-key fixture; legacy route currently requires API-key auth for management. | Added explicit smoke-only skip and file label. | Add real API-key dashboard fixture or route-backed setup before re-enabling. |
| `audience-layout.spec.ts` | Real browser E2E | Real auth/session; UI layout and navigation. | Migrated to `authenticatedPage`; fixed strict text locator. | None. |
| `automations-dashboard.spec.ts` | Mocked browser integration | Route-mocks auth, templates, automations, and runs. | Added file category label; retained as client-state proof only. | Replace with real automation/template fixtures before using for backend claims. |
| `billing-checkout.spec.ts` | Provider-gated API E2E | Requires `BILLING_BACKEND=stripe`, `STRIPE_SECRET_KEY`, `BILLING_E2E_SESSION_COOKIE`, `BILLING_E2E_PLAN_ID`. | Added category label; existing explicit skip is acceptable. | None unless billing becomes required in default E2E. |
| `billing-page.spec.ts` | Provider-gated/mocked integration | Disabled billing routes are real 404 checks; live Stripe path is skipped unless configured and route-mocked. | Added category label. | Use real auth fixture if hosted billing UI becomes core. |
| `bounce-rate.spec.ts` | Real browser UI E2E | Real auth/session; chart/info-panel UI only. | Migrated to `authenticatedPage`. | None. |
| `broadcast-editor-sidebar.spec.ts` | Smoke-only skipped | Needs deterministic auth-aware broadcast fixture; legacy request created `/broadcasts/undefined` logs. | Added explicit smoke-only skip and file label. | Add broadcast fixture with authorized API setup and cleanup. |
| `broadcast-editor.spec.ts` | Smoke-only skipped | Needs deterministic broadcast fixture and persisted editor setup. | Added explicit smoke-only skip and file label. | Add broadcast fixture before re-enabling. |
| `broadcast-review-panel.spec.ts` | Smoke-only skipped | Needs deterministic broadcast fixture. | Added explicit smoke-only skip and file label. | Add broadcast fixture before re-enabling. |
| `broadcasts-list.spec.ts` | Smoke-only skipped | Needs deterministic broadcast list data. | Added explicit smoke-only skip and file label. | Add broadcast fixture before re-enabling. |
| `complain-rate.spec.ts` | Real browser UI E2E | Real auth/session; chart/info-panel UI only. | Migrated to `authenticatedPage`. | None. |
| `contact-detail.spec.ts` | Smoke-only skipped | Needs deterministic contact fixture. | Added explicit smoke-only skip and file label. | Add contact detail fixture before re-enabling. |
| `contacts-list.spec.ts` | Smoke-only skipped | Needs deterministic contact list fixture. | Added explicit smoke-only skip and file label. | Add contact list fixture before re-enabling. |
| `domain-create-auth.spec.ts` | Provider-gated real browser E2E | Requires `DKIM_ENCRYPTION_KEY`; route generates DKIM key material. | Added explicit prerequisite skip. | Prefer local deterministic DKIM test key only if project policy allows. |
| `domain-detail.spec.ts` | Smoke-only | Requires existing domain; skips explicitly when absent. | Migrated to auth fixture and replaced silent no-op with explicit runtime skip. | Add domain fixture before using for correctness. |
| `domain-dns-records.spec.ts` | Smoke-only | Requires existing verified domain; skips explicitly when absent. | Added category label; existing skip retained. | Add verified-domain fixture before re-enabling by default. |
| `domains-page.spec.ts` | Real browser E2E + smoke navigation | List UI is deterministic; detail navigation requires seeded domain and skips explicitly when absent. | Uses auth fixture; replaced silent no-op with explicit skip. | Add domain fixture for detail navigation. |
| `email-detail-insights.spec.ts` | Smoke-only skipped | Needs deterministic email fixture. | Added explicit smoke-only skip and file label. | Add email fixture before re-enabling. |
| `email-detail.spec.ts` | Smoke-only skipped | Needs deterministic email fixture. | Added explicit smoke-only skip and file label. | Add email fixture before re-enabling. |
| `emails-alias.spec.ts` | API route E2E | Real public route behavior for Resend-compatible aliases and auth redirect. | Retained. | None. |
| `emails-data-table.spec.ts` | Real browser smoke | Real auth/session; asserts detail navigation when data exists or empty state. | Migrated to `authenticatedPage`. | Add deterministic email fixture for stronger detail proof. |
| `emails-filter-bar.spec.ts` | Real browser UI E2E + one smoke-only skipped case | Real auth/session for filter controls; URL resync case is skipped as flaky pending component-state follow-up. | Migrated to `authenticatedPage`; added explicit skip for flaky URL resync check. | Fix URL resync behavior or keep covered at component level before re-enabling. |
| `landing-page.spec.ts` | Public browser E2E | No auth required; includes protected-route checks. | Retained. | None. |
| `logs-search.spec.ts` | Real browser E2E | Requires `DATABASE_URL`; real auth/session and URL-backed search UI. | Migrated to `authenticatedPage`. | Seed deterministic log row if assertions expand beyond URL state. |
| `metrics-deliverability.spec.ts` | Real browser UI E2E | Real auth/session; chart/filter UI only. | Migrated to `authenticatedPage`. | None. |
| `openapi.spec.ts` | Public API route E2E | No auth required. | Retained. | None. |
| `properties.spec.ts` | Smoke-only skipped | Needs deterministic property modal fixture/cleanup. | Added explicit smoke-only skip and file label. | Add property fixture before re-enabling. |
| `segments.spec.ts` | Smoke-only skipped | Needs deterministic segment fixture/cleanup. | Added explicit smoke-only skip and file label. | Add segment fixture before re-enabling. |
| `settings-documents.spec.ts` | Smoke-only skipped | UI-copy smoke; assertions need refresh. | Added explicit smoke-only skip and file label. | Refresh assertions or add stable test ids. |
| `settings-usage.spec.ts` | Smoke-only skipped | UI-copy smoke; assertions need refresh. | Added explicit smoke-only skip and file label. | Refresh assertions or add stable quota fixture. |
| `sidebar-logout.spec.ts` | Mocked browser integration skipped | Security-adjacent; old auth route mocks do not prove Better Auth sign-out. | Added explicit skip and file label. | Convert to real Better Auth sign-out E2E before using for auth/security proof. |
| `smoke.spec.ts` | Real browser smoke | Real auth/session; dashboard shell/navigation. | Migrated to `authenticatedPage`; updated footer mailto expectations. | None. |
| `templates-list.spec.ts` | Smoke-only skipped | Needs deterministic template fixture/cleanup. | Added explicit smoke-only skip and file label. | Add template fixture before re-enabling. |
| `tenant-isolation.spec.ts` | Real API route E2E | Real Postgres users, API keys, contacts, and Next.js routes. | Added canonical tenant-isolation proof for issue #229. | Extend pattern to other tenant-owned resources as needed. |
| `topics.spec.ts` | Smoke-only skipped | Needs deterministic topic fixture/cleanup and modal selector refresh. | Added explicit smoke-only skip and file label. | Add topic fixture before re-enabling. |
| `unsubscribe.spec.ts` | Real browser + DB E2E | Requires `DATABASE_URL`; public route plus persisted contact update. | Retained. | None. |
