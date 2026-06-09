import { recordAuditEvent } from "@/lib/audit-events";
import { auth } from "@/lib/auth";
import {
  getRequestedWorkspaceId,
  mapWorkspaceServiceError,
} from "@/lib/workspace-route-auth";
import { workspaceService } from "@opensend/core";
import type { WorkspaceRole } from "@opensend/core";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function dashboardWorkspaceAuditContext(input: {
  tenantUserId: string;
  actorUserId: string;
  actorEmail?: string | null;
}) {
  return {
    userId: input.tenantUserId,
    actor: {
      type: "user" as const,
      id: input.actorUserId,
      email: input.actorEmail ?? null,
    },
    source: "dashboard" as const,
    sourceApiKeyId: null,
  };
}

function parseRoleBody(body: unknown): WorkspaceRole | { response: Response } {
  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const role = (data as Record<string, unknown>).role;

  if (role !== "admin" && role !== "member") {
    return {
      response: NextResponse.json(
        { error: "role must be admin or member" },
        { status: 422 },
      ),
    };
  }

  return role;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const role = parseRoleBody(body);
  if (typeof role !== "string") return role.response;

  const { id } = await params;
  try {
    const workspaceId = getRequestedWorkspaceId(request);
    const member = await workspaceService.updateMemberRole({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId,
      membershipId: id,
      role,
    });
    const context = await workspaceService.resolveWorkspaceContext({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId: member.workspace_id,
    });
    await recordAuditEvent({
      context: dashboardWorkspaceAuditContext({
        tenantUserId: context.tenantUserId,
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? null,
      }),
      action: "team.member.role_changed",
      targetType: "team",
      targetId: member.membership_id,
      metadata: {
        workspace_id: context.workspaceId,
        user_id: member.user_id,
        role: member.role,
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return unauthorized();

  const { id } = await params;
  try {
    const workspaceId = getRequestedWorkspaceId(request);
    const member = await workspaceService.removeMember({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId,
      membershipId: id,
    });
    const context = await workspaceService.resolveWorkspaceContext({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId: member.workspace_id,
    });
    await recordAuditEvent({
      context: dashboardWorkspaceAuditContext({
        tenantUserId: context.tenantUserId,
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? null,
      }),
      action: "team.member.removed",
      targetType: "team",
      targetId: member.membership_id,
      metadata: {
        workspace_id: context.workspaceId,
        user_id: member.user_id,
        role: member.role,
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}
