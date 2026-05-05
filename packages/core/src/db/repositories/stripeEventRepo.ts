import { eq } from "drizzle-orm";
import { db } from "../client";
import { stripeEventsProcessed } from "../schema";

export const stripeEventRepo = {
  async findById(eventId: string) {
    return await db.query.stripeEventsProcessed.findFirst({
      where: eq(stripeEventsProcessed.eventId, eventId),
    });
  },

  async markProcessed(
    eventId: string,
    type: string,
  ): Promise<{ created: boolean }> {
    const [row] = await db
      .insert(stripeEventsProcessed)
      .values({ eventId, type })
      .onConflictDoNothing({ target: stripeEventsProcessed.eventId })
      .returning();

    return { created: row !== undefined };
  },

  async deleteProcessed(eventId: string): Promise<void> {
    await db
      .delete(stripeEventsProcessed)
      .where(eq(stripeEventsProcessed.eventId, eventId));
  },
};
