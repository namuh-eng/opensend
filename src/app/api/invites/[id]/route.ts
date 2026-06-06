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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return unauthorized();

  const { id } = await params;
  try {
    const invitation = await workspaceService.revokeInvitation({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId: getRequestedWorkspaceId(request),
      invitationId: id,
    });
    return NextResponse.json(invitation);
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}
