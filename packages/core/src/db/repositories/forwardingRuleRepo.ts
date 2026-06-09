import { type SQL, and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import {
  domains,
  emails,
  forwardingAttempts,
  forwardingRules,
  receivingRoutes,
} from "../schema";

export type ForwardingRuleWithRoute = typeof forwardingRules.$inferSelect & {
  domainName: string;
  routeType: string;
  routeLocalPart: string | null;
  routeTargetLocalPart: string;
};

export type ForwardingAttemptWithEmailStatus =
  typeof forwardingAttempts.$inferSelect & {
    forwardedEmailStatus: string | null;
  };

const ruleWithRouteSelection = {
  id: forwardingRules.id,
  userId: forwardingRules.userId,
  domainId: forwardingRules.domainId,
  routeId: forwardingRules.routeId,
  destinations: forwardingRules.destinations,
  status: forwardingRules.status,
  invalidReason: forwardingRules.invalidReason,
  createdAt: forwardingRules.createdAt,
  updatedAt: forwardingRules.updatedAt,
  domainName: domains.name,
  routeType: receivingRoutes.type,
  routeLocalPart: receivingRoutes.localPart,
  routeTargetLocalPart: receivingRoutes.targetLocalPart,
};

const attemptWithEmailStatusSelection = {
  id: forwardingAttempts.id,
  userId: forwardingAttempts.userId,
  ruleId: forwardingAttempts.ruleId,
  receivedEmailId: forwardingAttempts.receivedEmailId,
  forwardedEmailId: forwardingAttempts.forwardedEmailId,
  status: forwardingAttempts.status,
  reason: forwardingAttempts.reason,
  destinations: forwardingAttempts.destinations,
  providerMessageId: forwardingAttempts.providerMessageId,
  retryEligible: forwardingAttempts.retryEligible,
  errorCode: forwardingAttempts.errorCode,
  errorMessage: forwardingAttempts.errorMessage,
  createdAt: forwardingAttempts.createdAt,
  updatedAt: forwardingAttempts.updatedAt,
  forwardedEmailStatus: emails.status,
};

export const forwardingRuleRepo = {
  async listForUser(options: { userId: string; domainId?: string }) {
    const conditions: SQL[] = [eq(forwardingRules.userId, options.userId)];
    if (options.domainId)
      conditions.push(eq(forwardingRules.domainId, options.domainId));

    return await db
      .select(ruleWithRouteSelection)
      .from(forwardingRules)
      .innerJoin(
        receivingRoutes,
        eq(forwardingRules.routeId, receivingRoutes.id),
      )
      .innerJoin(domains, eq(forwardingRules.domainId, domains.id))
      .where(and(...conditions))
      .orderBy(desc(forwardingRules.createdAt));
  },

  async listForRouteIds(userId: string, routeIds: string[]) {
    if (routeIds.length === 0) return [];
    return await db
      .select(ruleWithRouteSelection)
      .from(forwardingRules)
      .innerJoin(
        receivingRoutes,
        eq(forwardingRules.routeId, receivingRoutes.id),
      )
      .innerJoin(domains, eq(forwardingRules.domainId, domains.id))
      .where(
        and(
          eq(forwardingRules.userId, userId),
          inArray(forwardingRules.routeId, routeIds),
        ),
      )
      .orderBy(desc(forwardingRules.createdAt));
  },

  async findByIdForUser(id: string, userId: string) {
    const [rule] = await db
      .select(ruleWithRouteSelection)
      .from(forwardingRules)
      .innerJoin(
        receivingRoutes,
        eq(forwardingRules.routeId, receivingRoutes.id),
      )
      .innerJoin(domains, eq(forwardingRules.domainId, domains.id))
      .where(
        and(eq(forwardingRules.id, id), eq(forwardingRules.userId, userId)),
      )
      .limit(1);

    return rule;
  },

  async findByRouteIdForUser(routeId: string, userId: string) {
    const [rule] = await db
      .select(ruleWithRouteSelection)
      .from(forwardingRules)
      .innerJoin(
        receivingRoutes,
        eq(forwardingRules.routeId, receivingRoutes.id),
      )
      .innerJoin(domains, eq(forwardingRules.domainId, domains.id))
      .where(
        and(
          eq(forwardingRules.routeId, routeId),
          eq(forwardingRules.userId, userId),
        ),
      )
      .limit(1);

    return rule;
  },

  async create(data: typeof forwardingRules.$inferInsert) {
    const [created] = await db.insert(forwardingRules).values(data).returning();
    return created;
  },

  async update(
    id: string,
    userId: string,
    data: Partial<typeof forwardingRules.$inferInsert>,
  ) {
    const [updated] = await db
      .update(forwardingRules)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(forwardingRules.id, id), eq(forwardingRules.userId, userId)),
      )
      .returning();

    return updated;
  },

  async delete(id: string, userId: string) {
    const [deleted] = await db
      .delete(forwardingRules)
      .where(
        and(eq(forwardingRules.id, id), eq(forwardingRules.userId, userId)),
      )
      .returning({ id: forwardingRules.id });

    return deleted;
  },
};

export const forwardingAttemptRepo = {
  async create(data: typeof forwardingAttempts.$inferInsert) {
    const [created] = await db
      .insert(forwardingAttempts)
      .values(data)
      .returning();
    return created;
  },

  async listRecentForUser(options: { userId: string; limit: number }) {
    return await db
      .select(attemptWithEmailStatusSelection)
      .from(forwardingAttempts)
      .leftJoin(emails, eq(forwardingAttempts.forwardedEmailId, emails.id))
      .where(eq(forwardingAttempts.userId, options.userId))
      .orderBy(desc(forwardingAttempts.createdAt))
      .limit(options.limit);
  },

  async listForReceivedEmail(userId: string, receivedEmailId: string) {
    return await db
      .select(attemptWithEmailStatusSelection)
      .from(forwardingAttempts)
      .leftJoin(emails, eq(forwardingAttempts.forwardedEmailId, emails.id))
      .where(
        and(
          eq(forwardingAttempts.userId, userId),
          eq(forwardingAttempts.receivedEmailId, receivedEmailId),
        ),
      )
      .orderBy(desc(forwardingAttempts.createdAt));
  },
};
