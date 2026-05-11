import { type SQL, and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../client";
import { receivedEmails } from "../schema";

export const receivedEmailRepo = {
  async listForApi(options: { limit: number; after?: string; to?: string }) {
    const conditions: SQL[] = [];

    if (options.after) {
      conditions.push(lt(receivedEmails.id, options.after));
    }
    if (options.to) {
      conditions.push(sql`${receivedEmails.to} ? ${options.to}`);
    }

    const results = await db
      .select({
        id: receivedEmails.id,
        from: receivedEmails.from,
        to: receivedEmails.to,
        subject: receivedEmails.subject,
        createdAt: receivedEmails.createdAt,
      })
      .from(receivedEmails)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(receivedEmails.id))
      .limit(options.limit + 1);

    const hasMore = results.length > options.limit;
    const data = hasMore ? results.slice(0, options.limit) : results;

    return { data, hasMore };
  },

  async findById(id: string) {
    const [email] = await db
      .select()
      .from(receivedEmails)
      .where(eq(receivedEmails.id, id))
      .limit(1);

    return email;
  },

  async findAttachmentsByEmailId(id: string) {
    const [email] = await db
      .select({ attachments: receivedEmails.attachments })
      .from(receivedEmails)
      .where(eq(receivedEmails.id, id))
      .limit(1);

    return email;
  },
};
