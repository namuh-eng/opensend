import { recordAuditEvent } from "@/lib/audit-events";
import { auth } from "@/lib/auth";
import {
  getRequestedWorkspaceId,
  mapWorkspaceServiceError,
} from "@/lib/workspace-route-auth";
import { workspaceService } from "@opensend/core";
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return unauthorized();

  const { id } = await params;
  try {
    const workspaceId = getRequestedWorkspaceId(request);
    const invitation = await workspaceService.revokeInvitation({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId,
      invitationId: id,
    });
    const context = await workspaceService.resolveWorkspaceContext({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId,
    });
    await recordAuditEvent({
      context: dashboardWorkspaceAuditContext({
        tenantUserId: context.tenantUserId,
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? null,
      }),
      action: "team.invitation.revoked",
      targetType: "team",
      targetId: invitation.id,
      metadata: {
        workspace_id: context.workspaceId,
        email: invitation.email,
        role: invitation.role,
      },
    });
    return NextResponse.json(invitation);
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}
