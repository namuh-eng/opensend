import {
  type WorkspacePermissionAction,
  type WorkspaceRole,
  createWorkspaceService,
  hasWorkspacePermission,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

const actions = [
  "billing.manage",
  "invitations.manage",
  "roles.manage",
  "ownership.transfer",
  "api_keys.manage",
  "domains.manage",
  "webhooks.manage",
  "suppressions.manage",
  "exports.manage",
  "resources.read",
  "resources.use",
] as const satisfies readonly WorkspacePermissionAction[];

const expected: Record<WorkspaceRole, readonly WorkspacePermissionAction[]> = {
  owner: actions,
  admin: [
    "api_keys.manage",
    "domains.manage",
    "webhooks.manage",
    "suppressions.manage",
    "exports.manage",
    "resources.read",
    "resources.use",
  ],
  member: ["resources.read", "resources.use"],
};

describe("workspace permission matrix", () => {
  for (const role of ["owner", "admin", "member"] as const) {
    it(`${role} permissions match the first-slice matrix`, () => {
      const allowed = new Set(expected[role]);

      for (const action of actions) {
        expect(hasWorkspacePermission(role, action), `${role}:${action}`).toBe(
          allowed.has(action),
        );
      }
    });
  }

  it("defaults self-hosted entitlement checks to permissive without provider state", async () => {
    const service = createWorkspaceService({
      repository: {
        async findWorkspaceByOwnerUserId() {
          return {
            id: "workspace-1",
            name: "Owner Workspace",
            ownerUserId: "owner-1",
            createdAt: new Date("2026-06-01T00:00:00Z"),
            updatedAt: new Date("2026-06-01T00:00:00Z"),
          };
        },
        async findWorkspaceById() {
          return undefined;
        },
        async createWorkspace() {
          throw new Error("unexpected createWorkspace");
        },
        async findMembership() {
          return undefined;
        },
        async upsertMembership() {
          return {
            id: "membership-1",
            workspaceId: "workspace-1",
            userId: "owner-1",
            role: "owner",
            createdAt: new Date("2026-06-01T00:00:00Z"),
            updatedAt: new Date("2026-06-01T00:00:00Z"),
          };
        },
        async listMembers() {
          return [];
        },
        async findMembershipById() {
          return undefined;
        },
        async countMembershipsByRole() {
          return 1;
        },
        async updateMembershipRole() {
          return undefined;
        },
        async deleteMembership() {
          return undefined;
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
      },
    });

    await expect(
      service.checkEntitlement({ actorUserId: "owner-1", key: "api_keys" }),
    ).resolves.toEqual({
      key: "api_keys",
      enabled: true,
      limit: null,
      source: "self_hosted_default",
    });
  });
});
