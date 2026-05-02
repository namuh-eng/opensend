# OpenSend staging release notes — 2026-05-02 open-issue sweep

Base branch: `staging`
Current staging head after this sweep: `03c09345`

## Landed on staging

### PR #145 — Domain detail page 404 diagnostics/fix path
Issue: #127 — Domain detail page returns 404 for existing domains

What changed:
- The domain detail route now distinguishes invalid IDs from real backend/database failures instead of collapsing everything into a 404.
- Added focused regression coverage for non-UUID handling and database failure behavior.

What to test:
- Open an existing domain detail page from the dashboard and confirm it loads.
- Try a malformed/non-UUID domain detail URL and confirm it still returns the intended 404 UX.
- Simulate or observe backend/database failure behavior and confirm it surfaces as a real error rather than a fake missing domain.

### PR #146 — Automations foundation schema/contracts
Issue: #116 — automations: schema and contract foundation

What changed:
- Added the Drizzle migration and schema foundation for automations, automation steps, automation runs, and custom events.
- Added core repositories and DTO contracts for automation/event data.
- Added schema/repository tests.

What to test:
- Apply migrations in staging and verify automation tables exist.
- Smoke-test existing email/contact/dashboard flows to ensure the additive schema did not regress current product behavior.
- Use this as the foundation for #117/#118/#119; no user-facing automation UI is expected from this PR alone.

### PR #147 — Stripe billing foundation
Issue: #133 — Stripe paywall: plans + subscriptions + usage schema foundation

What changed:
- Added billing schema/repositories/DTOs for plans, subscriptions, Stripe customers, and usage periods.
- Added `BILLING_BACKEND` / billing feature-flag foundation, default-disabled.
- Resolved the migration collision with #146 by landing billing as migration `0006_billing_foundation` after automations migration `0005_automations_foundation`.
- Added billing repository/schema/flag tests.

Validation:
- `make check && make test` passed locally after conflict resolution.
- GitHub checks passed before merge.

What to test:
- Apply migrations on staging and verify both `0005_automations_foundation` and `0006_billing_foundation` are applied in order.
- With `BILLING_BACKEND=disabled` or unset, verify existing dashboard/email flows remain unchanged.
- Verify seed/default plan behavior where billing repository helpers are invoked.

### PR #148 — Public OpenSend landing page
Issue: #138 — Build opensend.namuh.co landing page

What changed:
- Added a public `/landing` route with hero, features, self-host CTA, hosted sign-in CTA, docs/GitHub links, footer, and SEO metadata.
- Updated middleware so `/landing` is public.
- Added unit and Playwright smoke coverage.

What to test:
- Visit `/landing` unauthenticated and confirm it renders publicly.
- Verify CTAs: self-host/GitHub links open the repo, docs goes to `/docs`, hosted/sign-in goes to `/auth`.
- Confirm dashboard/auth routes still behave normally.

### PR #158 — Enforce billing quota gates in send pipeline
Issue: #136 — Plan enforcement and quota gating
Merge commit: `822b40c9`

What changed:
- Added billing quota enforcement to the send pipeline so hosted-plan limits gate sends before work is queued/executed.
- Added structured quota-exceeded handling intended to preserve clear API behavior when hosted billing is enabled.
- Kept the billing backend feature-flagged so self-host/default-disabled flows remain compatible.

Validation:
- GitHub checks before merge: typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job was red from the known staging baseline at `bunx drizzle-kit push --config drizzle.config.ts`, not from this feature slice.

What to test:
- With billing disabled/unset, send a normal email/broadcast and confirm current behavior is unchanged.
- With hosted billing enabled and a quota-exceeded account/plan, verify send attempts are rejected with the expected quota response and no downstream send work is queued.
- Verify an account still under quota can send normally.

### PR #159 — Add dashboard billing and pricing UI
Issue: #137 — Billing/pricing dashboard UI
Merge commit: `5f9af29b`

What changed:
- Added hosted billing/pricing UI surfaces to the dashboard.
- Exposed plan/subscription/usage state so hosted accounts can see billing status and limits.
- Kept billing UI aligned with the existing dashboard patterns rather than introducing a separate shell.

Validation:
- GitHub checks before merge: typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job was red from the known staging baseline at `bunx drizzle-kit push --config drizzle.config.ts`.

What to test:
- Visit the dashboard billing/pricing page with billing disabled/default settings and confirm it fails gracefully or stays hidden according to product gating.
- Visit with hosted billing data present and verify plan name, usage/limits, and CTA/action states render correctly.
- Smoke-test adjacent dashboard navigation so the new billing UI did not regress the main dashboard shell.

### PR #160 — Automations dashboard MVP and runs viewer
Issue: #119 — Automations dashboard MVP and runs viewer
Merge commit: `ff164bd6`

What changed:
- Added the automations dashboard MVP surface.
- Added automation run visibility so users can inspect run state/history from the dashboard.
- Connected the UI layer to the existing automation foundation without treating post-MVP advanced step parity as complete.

Validation:
- GitHub checks before merge: typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job was red from the known staging baseline at `bunx drizzle-kit push --config drizzle.config.ts`.

What to test:
- Open the automations dashboard and confirm existing automations list correctly.
- Open an automation's run viewer and confirm run status/history details render.
- Verify empty-state behavior for accounts with no automations or runs.
- Confirm post-MVP advanced steps from #120 are not implied complete by this MVP landing.

### PR #157 — Pilot API-key thin adapters for control-plane split
Issue: #71 — Tracking: split monolith into `@namuh/core`, `@namuh/sdk`, `@namuh/ingester`
Merge commit: `03c09345`

What changed:
- Piloted API-key route extraction toward thin Next.js adapters and core service ownership.
- Preserved quota enforcement in `POST /api/api-keys` while delegating API-key creation through the core service boundary.
- Added `userId` propagation through the API-key service/repository path so auth/quota ownership remains intact after extraction.
- Tightened the broadcast list dropdown test by awaiting the async menu item, reducing CI flake risk.

Validation:
- Local validation after rebase/conflict fix: full Vitest suite passed (`84` files / `668` tests) and `bun run check` passed.
- GitHub checks before merge: typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job was red from the known staging baseline at `bunx drizzle-kit push --config drizzle.config.ts`.

What to test:
- Create an API key as an authenticated user and confirm it is associated with that user.
- Try API-key creation for a user over quota and confirm the quota response still blocks creation.
- List/revoke/use API keys through the existing dashboard/API flows to confirm the thin-adapter extraction did not regress behavior.
- Treat this as a control-plane split pilot only; the full #71 package/service split remains open.

## Staging CI status after final merge

GitHub Actions run `25255889751` on staging head `03c09345` completed with:

- `Lint (change-scoped)`: success
- `Unit tests (Vitest)`: success
- `Typecheck (full project)`: success
- `Onboarding acceptance`: failure

Known residual blocker:
- `Onboarding acceptance` fails during `bunx drizzle-kit push --config drizzle.config.ts` while pulling schema from Postgres.
- The same onboarding failure was present on staging before these PRs landed, so it is tracked as a shared CI/onboarding baseline issue rather than a regression introduced by #157/#158/#159/#160.

## Remaining open issues after this sweep

- #57 — Automations epic: still open as the umbrella; #119 dashboard MVP landed, but full trigger/step/run/event parity is not complete.
- #120 — Automations post-MVP advanced step parity: still open for advanced step behavior after MVP surfaces settle.
- #71 — Package/service split tracker: still open; #157 landed the API-key thin-adapter pilot only.
- #132 — Stripe paywall epic: still open as the hosted billing umbrella; #136/#137 slices landed, but full hosted billing/paywall flow is not complete.
- #17 — Multi-region SES failover: intentionally not implemented in this sweep because it needs an account/provider architecture decision. Prefer AWS SES Global Endpoints if available; otherwise implement explicit dual-region failover as a separate planned slice.

## Human staging checklist

- Apply/verify database migrations and seed data on staging once the onboarding CI baseline is fixed or worked around.
- Smoke-test auth/session, dashboard navigation, contacts/audience, domains, broadcasts, and email sending.
- Test quota gating with billing disabled, under quota, and over quota.
- Test billing/pricing dashboard states for disabled/self-host, hosted active plan, and missing subscription data.
- Test automations list/run viewer for empty, active, completed, and failed run states.
- Test API-key create/list/revoke flows, including quota-exceeded creation.
- Confirm `/landing` remains public and dashboard routes remain protected.
