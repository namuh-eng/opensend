import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { dedicatedIpPools } from "../schema";

export type DedicatedIpPoolStatus = "pending" | "active" | "failed";
export type DedicatedIpPoolScalingMode = "STANDARD" | "MANAGED";

export const dedicatedIpPoolRepo = {
  async findById(id: string) {
    return await db.query.dedicatedIpPools.findFirst({
      where: eq(dedicatedIpPools.id, id),
    });
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.dedicatedIpPools.findFirst({
      where: and(
        eq(dedicatedIpPools.id, id),
        eq(dedicatedIpPools.userId, userId),
      ),
    });
  },

  async findBySesPoolName(sesPoolName: string) {
    return await db.query.dedicatedIpPools.findFirst({
      where: eq(dedicatedIpPools.sesPoolName, sesPoolName),
    });
  },

  async listForUser(userId: string) {
    return await db
      .select()
      .from(dedicatedIpPools)
      .where(eq(dedicatedIpPools.userId, userId))
      .orderBy(desc(dedicatedIpPools.createdAt));
  },

  async countForUser(userId: string) {
    const rows = await db
      .select({ id: dedicatedIpPools.id })
      .from(dedicatedIpPools)
      .where(eq(dedicatedIpPools.userId, userId));
    return rows.length;
  },

  async create(data: typeof dedicatedIpPools.$inferInsert) {
    const [row] = await db.insert(dedicatedIpPools).values(data).returning();
    return row;
  },

  async updateStatus(id: string, status: DedicatedIpPoolStatus) {
    const [row] = await db
      .update(dedicatedIpPools)
      .set({ status, updatedAt: new Date() })
      .where(eq(dedicatedIpPools.id, id))
      .returning();
    return row;
  },

  async delete(id: string) {
    const [row] = await db
      .delete(dedicatedIpPools)
      .where(eq(dedicatedIpPools.id, id))
      .returning({ id: dedicatedIpPools.id });
    return row;
  },

  async deleteForUser(id: string, userId: string) {
    const [row] = await db
      .delete(dedicatedIpPools)
      .where(
        and(eq(dedicatedIpPools.id, id), eq(dedicatedIpPools.userId, userId)),
      )
      .returning({ id: dedicatedIpPools.id });
    return row;
  },
};
