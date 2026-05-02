import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { createBackgroundJob, publishBackgroundJob } from "@opensend/core";
import { and, eq, lte } from "drizzle-orm";

/**
 * processScheduledEmails
 *
 * Scans for emails with status 'scheduled' where scheduledAt is in the past
 * and publishes durable background jobs for worker-owned SES delivery.
 *
 * Production should run this from the ingester/worker service, triggered by
 * EventBridge on a short interval. Local development can call this helper or
 * POST /jobs/scheduled-emails on the ingester service.
 */
export async function processScheduledEmails() {
  const now = new Date();

  const pending = await db
    .select()
    .from(emails)
    .where(and(eq(emails.status, "scheduled"), lte(emails.scheduledAt, now)))
    .limit(50);

  if (pending.length === 0) return { processed: 0, enqueued: 0 };

  let enqueued = 0;

  for (const email of pending) {
    const result = await publishBackgroundJob(
      createBackgroundJob({
        id: `email.send:${email.id}`,
        type: "email.send",
        source: "scheduled-scan",
        emailId: email.id,
      }),
      {
        deduplicationId: `email.send:${email.id}`,
        groupId: "email.send",
      },
    );

    if (result.status === "published") {
      await db
        .update(emails)
        .set({ status: "queued" })
        .where(eq(emails.id, email.id));
      enqueued++;
    }
  }

  return {
    processed: pending.length,
    enqueued,
  };
}
