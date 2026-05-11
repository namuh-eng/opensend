---
date: 2026-05-11
issue: "#350"
type: pattern
promoted_to: null
---

## Dashboard aggregate service boundary

Issue #350 moved `/api/metrics` and `/api/usage` DB orchestration into `packages/core/src/services/dashboardAggregates.ts`. Keep dashboard session auth and dashboard aggregate cache reads/writes in the Next.js route adapter, but put metrics SQL aggregation, event-type-to-status mapping, payload shaping, usage period-bound calculations, and usage limit constants in the core service.

For metrics date ranges, the Next.js adapter still calls `src/lib/date-range.ts` and passes concrete `start`/`end` bounds into the core service. This preserves the dashboard picker preset semantics without making `@opensend/core` import app-local modules.

Shared smoke tests that mock `@opensend/core` need a `createDashboardAggregateService` mock; otherwise route-boundary extractions can pass focused tests but fail broad route smoke coverage.
