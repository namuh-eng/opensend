---
date: 2026-05-02
issue: "#119"
type: decision
promoted_to: null
---

## Keep Automations dashboard UI on the existing API foundation

**What:** The dashboard MVP should reuse the staging automation CRUD/runs APIs from #116/#117/#118 and add UI-specific list enrichment (step count and last run summary) instead of replacing those routes with a parallel dashboard-only implementation.

**Why:** The API and runner already own validation, user scoping, and run state shape. Duplicating route logic risks drifting from the runner contract and breaking API tests.

**Fix:** Add dashboard components and form helpers around the existing `trigger -> optional delay -> send_email -> end` payload, and keep any UI list needs as small additive API fields.
