import { recordAuditEvent } from "@/lib/audit-events";
import { auth } from "@/lib/auth";
import { mapWorkspaceServiceError } from "@/lib/workspace-route-auth";
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

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id || !session.user.email) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const token = (data as Record<string, unknown>).token;
  if (typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 422 });
  }

  try {
    const accepted = await workspaceService.acceptInvitation({
      actorUserId: session.user.id,
      actorEmail: session.user.email,
      token,
    });
    const context = await workspaceService.resolveWorkspaceContext({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId: accepted.membership.workspace_id,
    });
    await recordAuditEvent({
      context: dashboardWorkspaceAuditContext({
        tenantUserId: context.tenantUserId,
        actorUserId: session.user.id,
        actorEmail: session.user.email,
      }),
      action: "team.invitation.accepted",
      targetType: "team",
      targetId: accepted.invitation.id,
      metadata: {
        workspace_id: context.workspaceId,
        membership_id: accepted.membership.id,
        role: accepted.membership.role,
      },
    });
    return NextResponse.json(accepted);
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}
