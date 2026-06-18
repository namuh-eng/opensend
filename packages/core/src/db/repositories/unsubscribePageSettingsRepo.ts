import { eq } from "drizzle-orm";
import { db } from "../client";
import { unsubscribePageSettings } from "../schema";

export type {
  UnsubscribePageSettings,
  UnsubscribePageSettingsInsert,
} from "../schema";

export const unsubscribePageSettingsRepo = {
  async getByUserId(userId: string) {
    return await db.query.unsubscribePageSettings.findFirst({
      where: eq(unsubscribePageSettings.userId, userId),
    });
  },

  async upsert(
    userId: string,
    values: {
      logoUrl?: string | null;
      brandColor?: string;
      headline?: string;
      message?: string;
      footerText?: string;
    },
  ) {
    const now = new Date();
    const [row] = await db
      .insert(unsubscribePageSettings)
      .values({ userId, ...values, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: unsubscribePageSettings.userId,
        set: { ...values, updatedAt: now },
      })
      .returning();
    return row;
  },
};
