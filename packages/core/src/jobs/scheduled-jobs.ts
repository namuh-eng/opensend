/**
 * Shared constants for the ingester's recurring scheduled jobs.
 *
 * Single source of truth consumed by:
 *   - packages/ingester/src/job-scheduler.ts  (drives the HTTP calls)
 *   - src/app/api/health/scheduler/route.ts   (reads heartbeats for each name)
 */

export const SCHEDULED_JOB_NAMES = [
  "scheduled-emails",
  "webhooks",
  "domain-verify",
  "billing-overage",
] as const satisfies readonly string[];

export type ScheduledJobName = (typeof SCHEDULED_JOB_NAMES)[number];
