import {
  type WorkspaceMembershipRow,
  type WorkspaceRepository,
  createWorkspaceService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

const now = new Date("2026-06-08T12:00:00.000Z");
const workspace = {
  id: "workspace-1",
  name: "Owner Workspace",
  ownerUserId: "owner-1",
  createdAt: now,
  updatedAt: now,
};

function membership(input: {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  workspaceId?: string;
}): WorkspaceMembershipRow {
  return {
    id: input.id,
    workspaceId: input.workspaceId ?? workspace.id,
    userId: input.userId,
    role: input.role,
    createdAt: now,
    updatedAt: now,
  };
}

function createRepository(initialMemberships: WorkspaceMembershipRow[]) {
  const memberships = new Map(
    initialMemberships.map((row) => [row.id, { ...row }]),
  );
  const calls = {
    updateRole: 0,
    deleteMembership: 0,
  };

  const repository: WorkspaceRepository = {
    async findWorkspaceByOwnerUserId() {
      return workspace;
    },
    async findWorkspaceById(id) {
      return id === workspace.id ? workspace : undefined;
    },
    async createWorkspace() {
      throw new Error("unexpected createWorkspace");
    },
    async findMembership(workspaceId, userId) {
      return Array.from(memberships.values()).find(
        (row) => row.workspaceId === workspaceId && row.userId === userId,
      );
    },
    async findMembershipById(id, workspaceId) {
      const row = memberships.get(id);
      return row?.workspaceId === workspaceId ? row : undefined;
    },
    async upsertMembership(data) {
      const row = membership({
        id: "upserted-membership",
        workspaceId: data.workspaceId,
        userId: data.userId,
        role: data.role,
      });
      memberships.set(row.id, row);
      return row;
    },
    async listMembers() {
      return [];
    },
    async countMembershipsByRole(workspaceId, role) {
      return Array.from(memberships.values()).filter(
        (row) => row.workspaceId === workspaceId && row.role === role,
      ).length;
    },
    async updateMembershipRole(id, workspaceId, role) {
      calls.updateRole += 1;
      const row = memberships.get(id);
      if (!row || row.workspaceId !== workspaceId) return undefined;
      row.role = role;
      row.updatedAt = now;
      return row;
    },
    async deleteMembership(id, workspaceId) {
      calls.deleteMembership += 1;
      const row = memberships.get(id);
      if (!row || row.workspaceId !== workspaceId) return undefined;
      memberships.delete(id);
      return row;
    },
    async createInvitation() {
      throw new Error("unexpected createInvitation");
    },
    async findInvitationById() {
      return undefined;
    },
    async findInvitationByTokenHash() {
      return undefined;
    },
    async listInvitations() {
      return [];
    },
    async updateInvitation() {
      return undefined;
    },
    async findEntitlement() {
      return undefined;
    },
    async upsertEntitlement() {
      throw new Error("unexpected upsertEntitlement");
    },
  };

  return { repository, calls, memberships };
}

describe("workspace member lifecycle service", () => {
  it("allows an owner to change a member role inside the workspace", async () => {
    const { repository, calls, memberships } = createRepository([
      membership({ id: "owner-membership", userId: "owner-1", role: "owner" }),
      membership({ id: "member-membership", userId: "user-2", role: "member" }),
    ]);
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.updateMemberRole({
        actorUserId: "owner-1",
        workspaceId: workspace.id,
        membershipId: "member-membership",
        role: "admin",
      }),
    ).resolves.toMatchObject({
      membership_id: "member-membership",
      user_id: "user-2",
      role: "admin",
    });
    expect(calls.updateRole).toBe(1);
    expect(memberships.get("member-membership")?.role).toBe("admin");
  });

  it("blocks admins from changing roles", async () => {
    const { repository, calls } = createRepository([
      membership({ id: "owner-membership", userId: "owner-1", role: "owner" }),
      membership({ id: "admin-membership", userId: "admin-1", role: "admin" }),
      membership({ id: "member-membership", userId: "user-2", role: "member" }),
    ]);
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.updateMemberRole({
        actorUserId: "admin-1",
        workspaceId: workspace.id,
        membershipId: "member-membership",
        role: "admin",
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(calls.updateRole).toBe(0);
  });

  it("does not expose cross-tenant membership IDs", async () => {
    const { repository, calls } = createRepository([
      membership({ id: "owner-membership", userId: "owner-1", role: "owner" }),
      membership({
        id: "other-workspace-member",
        workspaceId: "workspace-2",
        userId: "user-2",
        role: "member",
      }),
    ]);
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.updateMemberRole({
        actorUserId: "owner-1",
        workspaceId: workspace.id,
        membershipId: "other-workspace-member",
        role: "admin",
      }),
    ).rejects.toMatchObject({
      code: "member_not_found",
    });
    expect(calls.updateRole).toBe(0);
  });

  it("rejects owner assignment through role editing", async () => {
    const { repository, calls } = createRepository([
      membership({ id: "owner-membership", userId: "owner-1", role: "owner" }),
      membership({ id: "member-membership", userId: "user-2", role: "member" }),
    ]);
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.updateMemberRole({
        actorUserId: "owner-1",
        workspaceId: workspace.id,
        membershipId: "member-membership",
        role: "owner",
      }),
    ).rejects.toMatchObject({
      code: "invalid_role",
    });
    expect(calls.updateRole).toBe(0);
  });

  it("allows an owner to remove another member", async () => {
    const { repository, calls, memberships } = createRepository([
      membership({ id: "owner-membership", userId: "owner-1", role: "owner" }),
      membership({ id: "member-membership", userId: "user-2", role: "member" }),
    ]);
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.removeMember({
        actorUserId: "owner-1",
        workspaceId: workspace.id,
        membershipId: "member-membership",
      }),
    ).resolves.toMatchObject({
      membership_id: "member-membership",
      user_id: "user-2",
      role: "member",
    });
    expect(calls.deleteMembership).toBe(1);
    expect(memberships.has("member-membership")).toBe(false);
  });

  it("blocks removing the actor owner membership", async () => {
    const { repository, calls } = createRepository([
      membership({ id: "owner-membership", userId: "owner-1", role: "owner" }),
    ]);
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.removeMember({
        actorUserId: "owner-1",
        workspaceId: workspace.id,
        membershipId: "owner-membership",
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(calls.deleteMembership).toBe(0);
  });
});
