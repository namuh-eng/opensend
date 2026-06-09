import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { domainDeliverabilityStatuses } from "../schema";

export type DomainDeliverabilityStatusRow =
  typeof domainDeliverabilityStatuses.$inferSelect;
export type DomainDeliverabilityStatusInsert =
  typeof domainDeliverabilityStatuses.$inferInsert;

export const domainDeliverabilityStatusRepo = {
  async findForDomain(domainId: string, userId: string) {
    return await db.query.domainDeliverabilityStatuses.findFirst({
      where: and(
        eq(domainDeliverabilityStatuses.domainId, domainId),
        eq(domainDeliverabilityStatuses.userId, userId),
      ),
    });
  },

  async ensureForDomain(domainId: string, userId: string) {
    const existing = await this.findForDomain(domainId, userId);
    if (existing) return existing;

    const [row] = await db
      .insert(domainDeliverabilityStatuses)
      .values({ domainId, userId })
      .returning();
    return row;
  },

  async updateForDomain(
    domainId: string,
    userId: string,
    updates: Partial<
      Pick<
        DomainDeliverabilityStatusInsert,
        | "bimiSelector"
        | "bimiStatus"
        | "bimiLogoUrl"
        | "bimiCertificateUrl"
        | "bimiNotes"
        | "appleBrandedMailStatus"
        | "appleBrandedMailNotes"
        | "lastCheckedAt"
      >
    >,
  ) {
    const [row] = await db
      .update(domainDeliverabilityStatuses)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(domainDeliverabilityStatuses.domainId, domainId),
          eq(domainDeliverabilityStatuses.userId, userId),
        ),
      )
      .returning();
    return row;
  },
};
