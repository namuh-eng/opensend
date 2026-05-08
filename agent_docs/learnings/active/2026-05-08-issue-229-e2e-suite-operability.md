---
date: 2026-05-08
issue: "#229"
type: pattern
promoted_to: null
---

## Full Playwright E2E must be operable from `make test-e2e`

The issue #229 E2E standard is only useful if the suite command exits green from
local setup. `make test-e2e` now sources `.env` before invoking Playwright so the
webServer and request tests see the same `DATABASE_URL`/auth config as manual
runs.

When a legacy Playwright spec cannot be made deterministic in the same issue,
label it in-file and in `tests/e2e/README.md`, then use an explicit `test.skip`
with the missing fixture/provider prerequisite. Do not leave conditional no-ops
that silently pass without proving behavior.
