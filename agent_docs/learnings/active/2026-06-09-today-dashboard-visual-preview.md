---
date: 2026-06-09
issue: today-dashboard-preview
type: pattern
promoted_to: null
---

## Prove Today dashboard metrics visually with seeded data

**What:** The Today page can have nonzero hourly totals while bars appear blank if the chart relies on percentage-height children inside a flex column. Use a stable `relative h-full` bucket and absolutely positioned bars for visible send/open/bounce overlays.

**Why:** The page aggregates real last-24h email rows and provider events server-side, but a collapsed visual layer makes the dashboard look unwired even when the data is present.

**Pattern:** For local visual QA, seed a dedicated preview tenant with `emails`, `email_events`, and verified `domains`, then view Today through a normal authenticated session. Keep visual proof data out of source and keep production provider-feedback gating tied to real SES/SNS wiring.
