# OpenSend staging release notes — 2026-05-02 open-issue sweep

Base branch: `staging`

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

## Still in progress / not merged yet

Workers are running against `staging` for:
- #117 — Automations API and events ingestion
- #118 — Automations MVP runner on background jobs
- #119 — Automations dashboard MVP and runs viewer
- #134 — Stripe Checkout + Customer Portal integration
- #135 — Stripe webhook handler
- #136 — Plan enforcement and quota gating
- #137 — Billing/pricing dashboard UI
- #17 — Multi-region SES failover / runbook

## Issues intentionally not treated as direct merge targets

- #57 — Automations epic: tracking/umbrella issue; implementation happens through #116-#120.
- #132 — Stripe paywall epic: tracking/umbrella issue; implementation happens through #133-#137.
- #71 — Package split tracking issue; broad architectural tracking issue, not safe to merge as a one-shot implementation without separate decomposition.
- #120 — Post-MVP advanced automation step parity; should wait until MVP API/runner/dashboard issues settle.
