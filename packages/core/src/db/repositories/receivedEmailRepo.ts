import { type SQL, and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "../client";
import { receivedEmails } from "../schema";

export const receivedEmailRepo = {
  async listForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    to?: string;
  }) {
    const conditions: SQL[] = [eq(receivedEmails.userId, options.userId)];

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

  async findById(id: string, userId: string) {
    const [email] = await db
      .select()
      .from(receivedEmails)
      .where(and(eq(receivedEmails.id, id), eq(receivedEmails.userId, userId)))
      .limit(1);

    return email;
  },

  async findAttachmentsByEmailId(id: string, userId: string) {
    const [email] = await db
      .select({ attachments: receivedEmails.attachments })
      .from(receivedEmails)
      .where(and(eq(receivedEmails.id, id), eq(receivedEmails.userId, userId)))
      .limit(1);

    return email;
  },
};
