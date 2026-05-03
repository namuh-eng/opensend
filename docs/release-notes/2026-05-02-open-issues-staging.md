# OpenSend staging release notes — 2026-05-02 open-issue sweep

Base branch: `staging`
Current staging head after this sweep: `b59ea10`

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

### PR #161 — Update staging release notes after PR #157-#160 merges
Merge commit: `bb66f4d`

What changed:
- Added this staging release-note/test checklist document for the open-issue sweep.
- Recorded landed PRs, known baseline CI status, and remaining open issue state after the previous merge wave.

Validation:
- Docs-only diff.
- GitHub typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job remained red from the known Drizzle baseline.

### PR #162 — Backend condition step branching for automations
Issue: #120 — automations: post-MVP advanced step parity
Merge commit: `0b90e926`

What changed:
- Added backend support for `condition` automation steps with a bounded single-predicate DSL.
- Added branch labels on automation connections: `default`, `condition_met`, and `condition_not_met`.
- Added graph validation so condition branches must originate from condition steps and duplicate branch labels are rejected.
- Added runner evaluation for event/contact/prior-step-output predicates and stores condition output as `{ matched, branch }` before advancing the selected branch.
- Added deterministic step-level failure behavior for missing variables, invalid predicate configs, and non-comparable operands.
- Left dashboard advanced-canvas UI out of scope; this is the backend slice only.

Validation:
- Local `bun run check:full` passed.
- Local full Vitest suite passed: `84` files / `679` tests.
- Local targeted condition tests passed: `tests/automation-runner.test.ts`, `tests/api-automations-events.test.ts`, `tests/core-automation-repo.test.ts` (`31` tests).
- GitHub checks before merge: typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job was red from the known staging baseline at `bunx drizzle-kit push --config drizzle.config.ts`; recent staging CI shows the same failure on unrelated staging heads.

What to test:
- Create an automation payload with a condition step and both condition branches; verify it is accepted and persisted.
- Try duplicate/misplaced condition branch labels and verify API validation returns a structured 422.
- Run a condition automation where the predicate matches and verify the run advances to the `condition_met` target with output `{ matched: true, branch: "condition_met" }`.
- Run a condition automation where the predicate does not match and verify the run advances to `condition_not_met`.
- Verify invalid/missing predicate variables fail the current step deterministically with a useful failure reason.

### PR #164 — Domains thin-adapter extraction
Issue: #71 — Tracking: split monolith into `@namuh/core`, `@namuh/sdk`, `@namuh/ingester`
Merge commit: `aa36a6f`

What changed:
- Extracted `POST /api/domains` domain create business logic into `packages/core/src/services/domain.ts` behind injectable dependencies.
- Added reusable domain list/create service methods so the Next.js route can stay focused on auth, parsing, quota gating, and HTTP response mapping.
- Preserved adapter-side billing quota enforcement and existing domain response shapes/status codes.
- Added focused domain service coverage and updated route thin-adapter tests.

Validation:
- Worker evidence before merge: `bun run test tests/domain-service.test.ts tests/api-domains.test.ts tests/quota-routes.test.ts tests/cache-invalidation-routes.test.ts`, `make check`, and `make test` passed.
- Controller recheck: `make check` passed locally; `tests/domain-service.test.ts` + `tests/cache-invalidation-routes.test.ts` passed locally.
- GitHub checks before merge: typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job was red from the known staging baseline at `bunx drizzle-kit push --config drizzle.config.ts`; recent staging CI showed the same unrelated failure on staging.

What to test:
- Create a domain through `POST /api/domains` and confirm SES identity/DNS records are produced and the domain is associated with the authenticated user.
- List domains through `GET /api/domains` and confirm pagination/response shape stayed compatible.
- Try domain creation for a user over quota and confirm the quota response still blocks before SES identity creation.
- Verify domain cache invalidation still runs after successful creation.
- Treat this as another #71 thin-adapter slice only; the broader control-plane split remains open.

### PR #165 — Record domains thin-adapter staging merge
Merge commit: `e7babaf`

What changed:
- Updated this release-note/checklist document after the PR #164 domains thin-adapter merge.
- Recorded the #164 validation evidence, staging CI status, and new domain-specific human validation checklist.

Validation:
- Docs-only diff.
- GitHub typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job remained red from the known Drizzle baseline.

What to test:
- No product behavior changed in this docs-only PR.
- Use the #164 domain checklist below for human staging validation.

### PR #168 — Automation wait-for-event resume behavior
Issue: #120 — automations: post-MVP advanced step parity
Merge commit: `b59ea10`
Feature commit: `db118fb`

What changed:
- Implemented backend support for `wait_for_event` automation steps that pause a run until a matching contact-scoped event arrives.
- Stored wait metadata in the existing automation run step-state JSON instead of adding another table for this bounded slice.
- Updated custom event ingestion so matching events resume waiting automation runs for the same user/contact/event name.
- Preserved deterministic timeout behavior: expired waits fail the current step with a useful timeout reason, while runs without matching events remain in `waiting` state.
- Kept request/cron routes non-blocking; no sleeps or long polling were introduced.

Validation:
- Feature commit evidence: `make check && make test` passed.
- Targeted Vitest coverage added/updated for `tests/automation-runner.test.ts`, `tests/api-automations-events.test.ts`, and `tests/core-automation-repo.test.ts`.
- GitHub checks before merge: typecheck, lint, and unit tests passed.
- The shared `Onboarding acceptance` job remained red from the known staging Drizzle baseline.
- Not covered by Playwright because this slice is backend-only; dashboard/editor parity remains under #120.

What to test:
- Create or seed an automation with a `wait_for_event` step configured for an allowed custom event name and an optional timeout.
- Trigger the automation and confirm the run enters `waiting` with `currentStepKey` set to the wait step and `nextStepAt` set when a timeout is configured.
- Send a non-matching event name for the same contact/user and confirm the run stays waiting.
- Send the matching event for a different contact and confirm the original run stays waiting.
- Send the matching event for the same user/contact and confirm the waiting step completes and the run advances to the next step.
- Let a wait pass its timeout, run the automation worker/cron path, and confirm the current step fails with a timeout reason rather than hanging indefinitely.
- Try invalid `wait_for_event` configs: reserved `resend:` event names, empty event names, non-positive timeout, and timeout above the 30-day max; confirm structured validation errors.
- Re-smoke the existing `trigger -> delay -> send_email -> end` and condition-branch automation paths to confirm wait support did not regress earlier automation behavior.

## Staging CI status after final merge

Latest staging head after this sweep: `b59ea10`.

PR #168 pre-merge GitHub checks completed with:

- `Lint (change-scoped)`: success
- `Unit tests (Vitest)`: success
- `Typecheck (full project)`: success
- `Onboarding acceptance`: failure

Known residual blocker:
- `Onboarding acceptance` fails during `bunx drizzle-kit push --config drizzle.config.ts` while pulling schema from Postgres.
- The same onboarding failure was present on staging before and after the open-issue PR wave, so it is tracked as a shared CI/onboarding baseline issue rather than a regression introduced by #157/#158/#159/#160/#162/#164/#168.

## Remaining open issues after this sweep

- #120 — Automations post-MVP advanced step parity: still open as a tracker; PR #162 landed backend condition branching and PR #168 landed backend wait-for-event resume behavior. Remaining work includes additional advanced step behavior and UI/editor parity.
- #71 — Package/service split tracker: still open; #157 landed the API-key thin-adapter pilot and #164 landed the domains thin-adapter slice, but the full control-plane split remains incomplete.
- #132 — Stripe paywall epic: still open as the hosted billing umbrella; #136/#137 slices landed, but full hosted billing/paywall flow is not complete.
- #17 — Multi-region SES failover: intentionally not implemented in this sweep because it needs an account/provider architecture decision. Prefer AWS SES Global Endpoints if available; otherwise implement explicit dual-region failover as a separate planned slice.

Closed during/after this sweep:
- #57 — Automations MVP epic was closed after QA verified the MVP `trigger -> delay -> send_email -> end` path. Post-MVP parity remains tracked by #120.

## Human staging checklist

- Apply/verify database migrations and seed data on staging once the onboarding CI baseline is fixed or worked around.
- Smoke-test auth/session, dashboard navigation, contacts/audience, domains, broadcasts, and email sending.
- Test quota gating with billing disabled, under quota, and over quota.
- Test billing/pricing dashboard states for disabled/self-host, hosted active plan, and missing subscription data.
- Test automations list/run viewer for empty, active, completed, and failed run states.
- Test automation condition branching API/runner behavior for matched, not-matched, invalid predicate, and missing-variable cases.
- Test automation wait-for-event behavior for waiting, non-matching event, wrong-contact event, matching event resume, timeout failure, and invalid config validation.
- Test API-key create/list/revoke flows, including quota-exceeded creation.
- Test domain create/list API flows, including quota-exceeded creation, SES DNS record output, pagination bounds, and dashboard domain UX.
- Confirm `/landing` remains public and dashboard routes remain protected.
