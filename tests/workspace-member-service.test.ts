import { createHash } from "node:crypto";
import {
  type WorkspaceInvitationRow,
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

function inviteTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invitation(input: {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  token: string;
  workspaceId?: string;
  status?: "pending" | "accepted" | "revoked" | "expired";
}): WorkspaceInvitationRow {
  return {
    id: input.id,
    workspaceId: input.workspaceId ?? workspace.id,
    email: input.email,
    role: input.role,
    tokenHash: inviteTokenHash(input.token),
    invitedByUserId: "owner-1",
    status: input.status ?? "pending",
    expiresAt: new Date("2026-06-09T12:00:00.000Z"),
    acceptedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createRepository(
  initialMemberships: WorkspaceMembershipRow[],
  initialInvitations: WorkspaceInvitationRow[] = [],
) {
  const memberships = new Map(
    initialMemberships.map((row) => [row.id, { ...row }]),
  );
  const invitations = new Map(
    initialInvitations.map((row) => [row.id, { ...row }]),
  );
  const calls = {
    updateRole: 0,
    deleteMembership: 0,
    upsertMembership: 0,
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
      calls.upsertMembership += 1;
      const existing = Array.from(memberships.values()).find(
        (row) =>
          row.workspaceId === data.workspaceId && row.userId === data.userId,
      );
      if (existing) {
        existing.role = data.role;
        existing.updatedAt = now;
        return existing;
      }
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
    async findInvitationByTokenHash(tokenHash) {
      return Array.from(invitations.values()).find(
        (row) => row.tokenHash === tokenHash,
      );
    },
    async listInvitations() {
      return [];
    },
    async updateInvitation(id, data) {
      const row = invitations.get(id);
      if (!row) return undefined;
      const updated = { ...row, ...data, updatedAt: now };
      invitations.set(id, updated);
      return updated;
    },
    async findEntitlement() {
      return undefined;
    },
    async upsertEntitlement() {
      throw new Error("unexpected upsertEntitlement");
    },
  };

  return { repository, calls, memberships, invitations };
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

  it("preserves an existing owner role when accepting a lower-role invite", async () => {
    const token = "owner-lower-role-token";
    const { repository, calls, invitations, memberships } = createRepository(
      [
        membership({
          id: "owner-membership",
          userId: "owner-1",
          role: "owner",
        }),
      ],
      [
        invitation({
          id: "owner-member-invite",
          email: "owner@example.com",
          role: "member",
          token,
        }),
      ],
    );
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.acceptInvitation({
        actorUserId: "owner-1",
        actorEmail: "OWNER@example.com",
        token,
      }),
    ).resolves.toMatchObject({
      invitation: {
        id: "owner-member-invite",
        status: "accepted",
      },
      membership: {
        id: "owner-membership",
        user_id: "owner-1",
        role: "owner",
      },
    });
    expect(calls.upsertMembership).toBe(0);
    expect(memberships.get("owner-membership")?.role).toBe("owner");
    expect(invitations.get("owner-member-invite")?.status).toBe("accepted");
    expect(invitations.get("owner-member-invite")?.acceptedAt).toBe(now);
  });

  it("preserves an existing member role when accepting an admin invite", async () => {
    const token = "member-admin-token";
    const { repository, calls, memberships } = createRepository(
      [
        membership({
          id: "member-membership",
          userId: "member-1",
          role: "member",
        }),
      ],
      [
        invitation({
          id: "member-admin-invite",
          email: "member@example.com",
          role: "admin",
          token,
        }),
      ],
    );
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.acceptInvitation({
        actorUserId: "member-1",
        actorEmail: "member@example.com",
        token,
      }),
    ).resolves.toMatchObject({
      membership: {
        id: "member-membership",
        user_id: "member-1",
        role: "member",
      },
    });
    expect(calls.upsertMembership).toBe(0);
    expect(memberships.get("member-membership")?.role).toBe("member");
  });

  it("creates a membership when a non-member accepts an invite", async () => {
    const token = "new-member-token";
    const { repository, calls, memberships } = createRepository(
      [
        membership({
          id: "owner-membership",
          userId: "owner-1",
          role: "owner",
        }),
      ],
      [
        invitation({
          id: "new-member-invite",
          email: "new-member@example.com",
          role: "member",
          token,
        }),
      ],
    );
    const service = createWorkspaceService({ repository, now: () => now });

    await expect(
      service.acceptInvitation({
        actorUserId: "new-member-1",
        actorEmail: "new-member@example.com",
        token,
      }),
    ).resolves.toMatchObject({
      membership: {
        user_id: "new-member-1",
        role: "member",
      },
    });
    expect(calls.upsertMembership).toBe(1);
    expect(
      Array.from(memberships.values()).some(
        (row) => row.userId === "new-member-1" && row.role === "member",
      ),
    ).toBe(true);
  });
});
