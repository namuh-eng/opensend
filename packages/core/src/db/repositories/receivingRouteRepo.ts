import { type SQL, and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { domains, receivingRoutes } from "../schema";

export type ReceivingRouteWithDomain = typeof receivingRoutes.$inferSelect & {
  domainName: string;
  domainStatus: string;
  domainCapabilities: (typeof domains.$inferSelect)["capabilities"];
};

const routeWithDomainSelection = {
  id: receivingRoutes.id,
  userId: receivingRoutes.userId,
  domainId: receivingRoutes.domainId,
  type: receivingRoutes.type,
  localPart: receivingRoutes.localPart,
  targetLocalPart: receivingRoutes.targetLocalPart,
  createdAt: receivingRoutes.createdAt,
  updatedAt: receivingRoutes.updatedAt,
  domainName: domains.name,
  domainStatus: domains.status,
  domainCapabilities: domains.capabilities,
};

export const receivingRouteRepo = {
  async listForUser(options: { userId: string; domainId?: string }) {
    const conditions: SQL[] = [eq(receivingRoutes.userId, options.userId)];
    if (options.domainId) {
      conditions.push(eq(receivingRoutes.domainId, options.domainId));
    }

    return await db
      .select(routeWithDomainSelection)
      .from(receivingRoutes)
      .innerJoin(domains, eq(receivingRoutes.domainId, domains.id))
      .where(and(...conditions))
      .orderBy(desc(receivingRoutes.createdAt));
  },

  async listForDomain(domainId: string) {
    return await db
      .select(routeWithDomainSelection)
      .from(receivingRoutes)
      .innerJoin(domains, eq(receivingRoutes.domainId, domains.id))
      .where(eq(receivingRoutes.domainId, domainId))
      .orderBy(desc(receivingRoutes.createdAt));
  },

  async findByIdForUser(id: string, userId: string) {
    const [route] = await db
      .select(routeWithDomainSelection)
      .from(receivingRoutes)
      .innerJoin(domains, eq(receivingRoutes.domainId, domains.id))
      .where(
        and(eq(receivingRoutes.id, id), eq(receivingRoutes.userId, userId)),
      )
      .limit(1);

    return route;
  },

  async create(data: typeof receivingRoutes.$inferInsert) {
    const [created] = await db.insert(receivingRoutes).values(data).returning();
    return created;
  },

  async update(
    id: string,
    userId: string,
    data: Partial<typeof receivingRoutes.$inferInsert>,
  ) {
    const [updated] = await db
      .update(receivingRoutes)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(receivingRoutes.id, id), eq(receivingRoutes.userId, userId)),
      )
      .returning();

    return updated;
  },

  async delete(id: string, userId: string) {
    const [deleted] = await db
      .delete(receivingRoutes)
      .where(
        and(eq(receivingRoutes.id, id), eq(receivingRoutes.userId, userId)),
      )
      .returning({ id: receivingRoutes.id });

    return deleted;
  },
};
