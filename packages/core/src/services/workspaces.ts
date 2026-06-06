import { createHash, randomBytes } from "node:crypto";
import {
  type WorkspaceEntitlementRow,
  type WorkspaceInvitationRow,
  type WorkspaceMemberWithUser,
  type WorkspaceMembershipRow,
  type WorkspaceRow,
  workspaceRepo,
} from "../db/repositories/workspaceRepo";
import type { WorkspaceInvitationStatus, WorkspaceRole } from "../db/schema";

export type WorkspacePermissionAction =
  | "billing.manage"
  | "invitations.manage"
  | "roles.manage"
  | "ownership.transfer"
  | "api_keys.manage"
  | "domains.manage"
  | "webhooks.manage"
  | "suppressions.manage"
  | "exports.manage"
  | "resources.read"
  | "resources.use";

const WORKSPACE_PERMISSIONS: Record<
  WorkspaceRole,
  ReadonlySet<WorkspacePermissionAction>
> = {
  owner: new Set<WorkspacePermissionAction>([
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
  ]),
  admin: new Set<WorkspacePermissionAction>([
    "api_keys.manage",
    "domains.manage",
    "webhooks.manage",
    "suppressions.manage",
    "exports.manage",
    "resources.read",
    "resources.use",
  ]),
  member: new Set<WorkspacePermissionAction>([
    "resources.read",
    "resources.use",
  ]),
};

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  actorUserId: string;
  tenantUserId: string;
  role: WorkspaceRole;
};

export type WorkspaceEntitlementCheck = {
  key: string;
  enabled: boolean;
  limit: number | null;
  source: "self_hosted_default" | WorkspaceEntitlementRow["source"];
};

export type WorkspaceServiceErrorCode =
  | "forbidden"
  | "invalid_email"
  | "invalid_role"
  | "invite_not_found"
  | "invite_not_pending"
  | "invite_expired"
  | "invite_email_mismatch"
  | "workspace_not_found";

export class WorkspaceServiceError extends Error {
  constructor(
    readonly code: WorkspaceServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

export type WorkspaceRepository = typeof workspaceRepo;

export type WorkspaceServiceDependencies = {
  repository?: WorkspaceRepository;
  now?: () => Date;
  generateInviteToken?: () => string;
};

function defaultWorkspaceName(userName?: string | null): string {
  const trimmed = userName?.trim();
  return trimmed ? `${trimmed}'s Workspace` : "Personal Workspace";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidInviteEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAssignableRole(role: WorkspaceRole): boolean {
  return role === "admin" || role === "member";
}

function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function defaultInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hasWorkspacePermission(
  role: WorkspaceRole,
  action: WorkspacePermissionAction,
): boolean {
  return WORKSPACE_PERMISSIONS[role].has(action);
}

function requireWorkspacePermission(
  role: WorkspaceRole,
  action: WorkspacePermissionAction,
): void {
  if (!hasWorkspacePermission(role, action)) {
    throw new WorkspaceServiceError(
      "forbidden",
      "Your workspace role does not have permission to access this resource.",
    );
  }
}

function toContext(input: {
  workspace: WorkspaceRow;
  actorUserId: string;
  membership: WorkspaceMembershipRow;
}): WorkspaceContext {
  return {
    workspaceId: input.workspace.id,
    workspaceName: input.workspace.name,
    actorUserId: input.actorUserId,
    tenantUserId: input.workspace.ownerUserId,
    role: input.membership.role,
  };
}

function toMember(row: WorkspaceMemberWithUser) {
  return {
    id: row.userId,
    membership_id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.createdAt,
  };
}

function toInvitation(row: WorkspaceInvitationRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expires_at: row.expiresAt,
    created_at: row.createdAt,
    accepted_at: row.acceptedAt,
    revoked_at: row.revokedAt,
  };
}

export function createWorkspaceService({
  repository = workspaceRepo,
  now = () => new Date(),
  generateInviteToken = defaultInviteToken,
}: WorkspaceServiceDependencies = {}) {
  async function ensureDefaultWorkspaceForUser(input: {
    userId: string;
    userName?: string | null;
  }): Promise<WorkspaceContext> {
    let workspace = await repository.findWorkspaceByOwnerUserId(input.userId);
    if (!workspace) {
      workspace = await repository.createWorkspace({
        name: defaultWorkspaceName(input.userName),
        ownerUserId: input.userId,
      });
    }

    const membership = await repository.upsertMembership({
      workspaceId: workspace.id,
      userId: input.userId,
      role: "owner",
    });

    return toContext({ workspace, actorUserId: input.userId, membership });
  }

  async function resolveWorkspaceContext(input: {
    actorUserId: string;
    actorName?: string | null;
    workspaceId?: string | null;
  }): Promise<WorkspaceContext> {
    if (!input.workspaceId) {
      return ensureDefaultWorkspaceForUser({
        userId: input.actorUserId,
        userName: input.actorName,
      });
    }

    const workspace = await repository.findWorkspaceById(input.workspaceId);
    if (!workspace) {
      throw new WorkspaceServiceError(
        "workspace_not_found",
        "Workspace not found",
      );
    }

    const membership = await repository.findMembership(
      workspace.id,
      input.actorUserId,
    );
    if (!membership) {
      throw new WorkspaceServiceError("forbidden", "Workspace access denied");
    }

    return toContext({
      workspace,
      actorUserId: input.actorUserId,
      membership,
    });
  }

  async function requirePermission(input: {
    actorUserId: string;
    actorName?: string | null;
    workspaceId?: string | null;
    action: WorkspacePermissionAction;
  }): Promise<WorkspaceContext> {
    const context = await resolveWorkspaceContext(input);
    requireWorkspacePermission(context.role, input.action);
    return context;
  }

  return {
    ensureDefaultWorkspaceForUser,
    resolveWorkspaceContext,
    requirePermission,

    async listWorkspaceMembers(input: {
      actorUserId: string;
      actorName?: string | null;
      workspaceId?: string | null;
    }) {
      const context = await requirePermission({
        ...input,
        action: "resources.read",
      });
      const [members, invitations] = await Promise.all([
        repository.listMembers(context.workspaceId),
        repository.listInvitations(context.workspaceId),
      ]);

      return {
        object: "list" as const,
        workspace: {
          id: context.workspaceId,
          name: context.workspaceName,
          owner_user_id: context.tenantUserId,
          role: context.role,
        },
        data: members.map(toMember),
        invitations: invitations.map(toInvitation),
      };
    },

    async createInvitation(input: {
      actorUserId: string;
      actorName?: string | null;
      workspaceId?: string | null;
      email: string;
      role: WorkspaceRole;
      expiresAt?: Date;
    }) {
      const context = await requirePermission({
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        workspaceId: input.workspaceId,
        action: "invitations.manage",
      });

      if (!isAssignableRole(input.role)) {
        throw new WorkspaceServiceError(
          "invalid_role",
          "Invitations can only assign admin or member roles.",
        );
      }

      const email = normalizeEmail(input.email);
      if (!isValidInviteEmail(email)) {
        throw new WorkspaceServiceError("invalid_email", "email is invalid");
      }

      const token = generateInviteToken();
      const expiresAt =
        input.expiresAt ?? new Date(now().getTime() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await repository.createInvitation({
        workspaceId: context.workspaceId,
        email,
        role: input.role,
        tokenHash: hashInviteToken(token),
        invitedByUserId: input.actorUserId,
        status: "pending",
        expiresAt,
      });

      return {
        ...toInvitation(invitation),
        token,
      };
    },

    async revokeInvitation(input: {
      actorUserId: string;
      actorName?: string | null;
      workspaceId?: string | null;
      invitationId: string;
    }) {
      const context = await requirePermission({
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        workspaceId: input.workspaceId,
        action: "invitations.manage",
      });
      const invitation = await repository.findInvitationById(
        input.invitationId,
        context.workspaceId,
      );
      if (!invitation) {
        throw new WorkspaceServiceError(
          "invite_not_found",
          "Workspace invitation not found",
        );
      }
      if (invitation.status !== "pending") {
        throw new WorkspaceServiceError(
          "invite_not_pending",
          "Workspace invitation is not pending",
        );
      }

      const revoked = await repository.updateInvitation(invitation.id, {
        status: "revoked" satisfies WorkspaceInvitationStatus,
        revokedAt: now(),
      });
      if (!revoked) {
        throw new WorkspaceServiceError(
          "invite_not_found",
          "Workspace invitation not found",
        );
      }
      return toInvitation(revoked);
    },

    async acceptInvitation(input: {
      actorUserId: string;
      actorEmail: string;
      token: string;
    }) {
      const invitation = await repository.findInvitationByTokenHash(
        hashInviteToken(input.token),
      );
      if (!invitation) {
        throw new WorkspaceServiceError(
          "invite_not_found",
          "Workspace invitation not found",
        );
      }
      if (invitation.status !== "pending") {
        throw new WorkspaceServiceError(
          "invite_not_pending",
          "Workspace invitation is not pending",
        );
      }
      if (invitation.expiresAt.getTime() <= now().getTime()) {
        await repository.updateInvitation(invitation.id, {
          status: "expired" satisfies WorkspaceInvitationStatus,
        });
        throw new WorkspaceServiceError(
          "invite_expired",
          "Workspace invitation has expired",
        );
      }
      if (normalizeEmail(input.actorEmail) !== invitation.email) {
        throw new WorkspaceServiceError(
          "invite_email_mismatch",
          "Workspace invitation is for a different email address",
        );
      }

      const membership = await repository.upsertMembership({
        workspaceId: invitation.workspaceId,
        userId: input.actorUserId,
        role: invitation.role,
      });
      const accepted = await repository.updateInvitation(invitation.id, {
        status: "accepted" satisfies WorkspaceInvitationStatus,
        acceptedAt: now(),
      });

      return {
        invitation: accepted
          ? toInvitation(accepted)
          : toInvitation(invitation),
        membership: {
          id: membership.id,
          workspace_id: membership.workspaceId,
          user_id: membership.userId,
          role: membership.role,
        },
      };
    },

    async checkEntitlement(input: {
      actorUserId: string;
      actorName?: string | null;
      workspaceId?: string | null;
      key: string;
    }): Promise<WorkspaceEntitlementCheck> {
      const context = await requirePermission({
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        workspaceId: input.workspaceId,
        action: "resources.use",
      });
      const entitlement = await repository.findEntitlement(
        context.workspaceId,
        input.key,
      );
      if (!entitlement) {
        return {
          key: input.key,
          enabled: true,
          limit: null,
          source: "self_hosted_default",
        };
      }
      return {
        key: entitlement.key,
        enabled: entitlement.enabled,
        limit: entitlement.limit,
        source: entitlement.source,
      };
    },
  };
}

export const workspaceService = createWorkspaceService();
