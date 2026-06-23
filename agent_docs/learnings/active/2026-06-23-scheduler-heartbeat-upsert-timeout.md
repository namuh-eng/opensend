---
date: 2026-06-23
issue: scheduler-heartbeat-missing
type: mistake
promoted_to: null
---

# Scheduler heartbeat writes must be bounded

Production scheduler logs stopped immediately after `scheduled-emails` completed
and before the next job started, while ECS still reported one running scheduler
task. The shared heartbeat alarm correctly fired because no
`SchedulerHeartbeat` EMF datapoints arrived for three one-minute periods, and
`/api/health/scheduler` showed all DB heartbeat rows stale.

The scheduler had a timeout around each ingester HTTP job request, but the
post-job DB heartbeat upsert was unbounded. A stuck Postgres write could hold
the scheduler loop without crashing the ECS task. Keep scheduler side effects
bounded and logged; liveness metrics should prove the loop is alive even when
per-job heartbeat persistence has a transient database problem.
