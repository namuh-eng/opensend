import { and, asc, count, eq } from "drizzle-orm";
import { db } from "../client";
import {
  user,
  workspaceEntitlements,
  workspaceInvitations,
  workspaceMemberships,
  workspaces,
} from "../schema";

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type WorkspaceInsert = typeof workspaces.$inferInsert;
export type WorkspaceMembershipRow = typeof workspaceMemberships.$inferSelect;
export type WorkspaceMembershipInsert =
  typeof workspaceMemberships.$inferInsert;
export type WorkspaceInvitationRow = typeof workspaceInvitations.$inferSelect;
export type WorkspaceInvitationInsert =
  typeof workspaceInvitations.$inferInsert;
export type WorkspaceEntitlementRow = typeof workspaceEntitlements.$inferSelect;
export type WorkspaceEntitlementInsert =
  typeof workspaceEntitlements.$inferInsert;

export type WorkspaceMemberWithUser = Pick<
  WorkspaceMembershipRow,
  "id" | "workspaceId" | "userId" | "role" | "createdAt" | "updatedAt"
> & {
  name: string;
  email: string;
};

export const workspaceRepo = {
  async findWorkspaceByOwnerUserId(
    ownerUserId: string,
  ): Promise<WorkspaceRow | undefined> {
    return await db.query.workspaces.findFirst({
      where: eq(workspaces.ownerUserId, ownerUserId),
    });
  },

  async findWorkspaceById(id: string): Promise<WorkspaceRow | undefined> {
    return await db.query.workspaces.findFirst({
      where: eq(workspaces.id, id),
    });
  },

  async createWorkspace(data: WorkspaceInsert): Promise<WorkspaceRow> {
    const [created] = await db.insert(workspaces).values(data).returning();
    if (!created) throw new Error("Failed to create workspace");
    return created;
  },

  async findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipRow | undefined> {
    return await db.query.workspaceMemberships.findFirst({
      where: and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
      ),
    });
  },

  async findMembershipById(
    id: string,
    workspaceId: string,
  ): Promise<WorkspaceMembershipRow | undefined> {
    return await db.query.workspaceMemberships.findFirst({
      where: and(
        eq(workspaceMemberships.id, id),
        eq(workspaceMemberships.workspaceId, workspaceId),
      ),
    });
  },

  async upsertMembership(
    data: WorkspaceMembershipInsert,
  ): Promise<WorkspaceMembershipRow> {
    const [membership] = await db
      .insert(workspaceMemberships)
      .values(data)
      .onConflictDoUpdate({
        target: [workspaceMemberships.workspaceId, workspaceMemberships.userId],
        set: {
          role: data.role,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!membership) throw new Error("Failed to upsert workspace membership");
    return membership;
  },

  async listMembers(workspaceId: string): Promise<WorkspaceMemberWithUser[]> {
    return await db
      .select({
        id: workspaceMemberships.id,
        workspaceId: workspaceMemberships.workspaceId,
        userId: workspaceMemberships.userId,
        role: workspaceMemberships.role,
        createdAt: workspaceMemberships.createdAt,
        updatedAt: workspaceMemberships.updatedAt,
        name: user.name,
        email: user.email,
      })
      .from(workspaceMemberships)
      .innerJoin(user, eq(user.id, workspaceMemberships.userId))
      .where(eq(workspaceMemberships.workspaceId, workspaceId))
      .orderBy(asc(workspaceMemberships.createdAt));
  },

  async countMembershipsByRole(
    workspaceId: string,
    role: WorkspaceMembershipRow["role"],
  ): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.role, role),
        ),
      );
    return row?.value ?? 0;
  },

  async updateMembershipRole(
    id: string,
    workspaceId: string,
    role: WorkspaceMembershipRow["role"],
  ): Promise<WorkspaceMembershipRow | undefined> {
    const [updated] = await db
      .update(workspaceMemberships)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceMemberships.id, id),
          eq(workspaceMemberships.workspaceId, workspaceId),
        ),
      )
      .returning();
    return updated;
  },

  async deleteMembership(
    id: string,
    workspaceId: string,
  ): Promise<WorkspaceMembershipRow | undefined> {
    const [deleted] = await db
      .delete(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.id, id),
          eq(workspaceMemberships.workspaceId, workspaceId),
        ),
      )
      .returning();
    return deleted;
  },

  async createInvitation(
    data: WorkspaceInvitationInsert,
  ): Promise<WorkspaceInvitationRow> {
    const [created] = await db
      .insert(workspaceInvitations)
      .values(data)
      .returning();
    if (!created) throw new Error("Failed to create workspace invitation");
    return created;
  },

  async findInvitationById(
    id: string,
    workspaceId: string,
  ): Promise<WorkspaceInvitationRow | undefined> {
    return await db.query.workspaceInvitations.findFirst({
      where: and(
        eq(workspaceInvitations.id, id),
        eq(workspaceInvitations.workspaceId, workspaceId),
      ),
    });
  },

  async findInvitationByTokenHash(
    tokenHash: string,
  ): Promise<WorkspaceInvitationRow | undefined> {
    return await db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.tokenHash, tokenHash),
    });
  },

  async listInvitations(
    workspaceId: string,
  ): Promise<WorkspaceInvitationRow[]> {
    return await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.workspaceId, workspaceId))
      .orderBy(asc(workspaceInvitations.createdAt));
  },

  async updateInvitation(
    id: string,
    data: Partial<WorkspaceInvitationInsert>,
  ): Promise<WorkspaceInvitationRow | undefined> {
    const [updated] = await db
      .update(workspaceInvitations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspaceInvitations.id, id))
      .returning();
    return updated;
  },

  async findEntitlement(
    workspaceId: string,
    key: string,
  ): Promise<WorkspaceEntitlementRow | undefined> {
    return await db.query.workspaceEntitlements.findFirst({
      where: and(
        eq(workspaceEntitlements.workspaceId, workspaceId),
        eq(workspaceEntitlements.key, key),
      ),
    });
  },

  async upsertEntitlement(
    data: WorkspaceEntitlementInsert,
  ): Promise<WorkspaceEntitlementRow> {
    const [entitlement] = await db
      .insert(workspaceEntitlements)
      .values(data)
      .onConflictDoUpdate({
        target: [workspaceEntitlements.workspaceId, workspaceEntitlements.key],
        set: {
          enabled: data.enabled,
          limit: data.limit,
          source: data.source,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!entitlement) throw new Error("Failed to upsert workspace entitlement");
    return entitlement;
  },
};
