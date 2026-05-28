import { eq } from "drizzle-orm";
import { db } from "../client";
import { schedulerHeartbeats } from "../schema";

type HeartbeatRow = typeof schedulerHeartbeats.$inferSelect;

export const schedulerHeartbeatRepo = {
  /**
   * Upserts a heartbeat for a scheduled job. Called after each invocation.
   * @param jobName  The job name (one of SCHEDULED_JOB_NAMES).
   * @param result   Arbitrary JSON payload (interval_ms, status, counts, etc.).
   */
  async upsert(
    jobName: string,
    result: Record<string, unknown>,
  ): Promise<HeartbeatRow> {
    const [row] = await db
      .insert(schedulerHeartbeats)
      .values({
        jobName,
        lastSeenAt: new Date(),
        lastResult: result,
      })
      .onConflictDoUpdate({
        target: schedulerHeartbeats.jobName,
        set: {
          lastSeenAt: new Date(),
          lastResult: result,
        },
      })
      .returning();

    if (!row)
      throw new Error(
        `schedulerHeartbeatRepo.upsert: no row returned for ${jobName}`,
      );
    return row;
  },

  async findByJobName(jobName: string): Promise<HeartbeatRow | undefined> {
    return await db.query.schedulerHeartbeats.findFirst({
      where: eq(schedulerHeartbeats.jobName, jobName),
    });
  },

  async listAll(): Promise<HeartbeatRow[]> {
    return await db.select().from(schedulerHeartbeats);
  },
};
