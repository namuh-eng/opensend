---
date: 2026-06-01
issue: scheduler-ecs-deploy
type: pattern
promoted_to: null
---

# Scheduler ECS deploy boundary

When deploying the ingester scheduler as its own ECS service, clone the ingester task's DB and auth secret boundary instead of treating the scheduler as a pure unauthenticated HTTP loop. `job-scheduler.js` imports `@opensend/core`, which can initialize Better Auth code paths; omitting `BETTER_AUTH_SECRET` caused the scheduler task to run one batch and then exit with `BetterAuthError: You are using the default secret`.

The dedicated scheduler task should include at minimum `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `INGESTER_JOB_TOKEN`, plus Google OAuth secrets if present to avoid startup warning noise from imported auth config.

Also keep local agent state out of Docker build contexts: `.claude/` worktrees inflated an ingester build context above 2 GB until `.dockerignore` excluded `.claude` and `.handoffs`.
