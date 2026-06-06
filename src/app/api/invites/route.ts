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

function parseInviteBody(
  body: unknown,
):
  | { email: string; role: WorkspaceRole; expiresAt?: Date }
  | { response: Response } {
  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const record = data as Record<string, unknown>;
  const role =
    record.role === "admin" || record.role === "member"
      ? record.role
      : "member";
  const expiresAt =
    typeof record.expires_at === "string"
      ? new Date(record.expires_at)
      : undefined;

  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return {
      response: NextResponse.json(
        { error: "expires_at must be a valid ISO timestamp" },
        { status: 422 },
      ),
    };
  }

  return {
    email: typeof record.email === "string" ? record.email : "",
    role,
    expiresAt,
  };
}

/**
 * GET /api/invites
 *
 * Lists members and pending invitation state for the selected workspace.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return unauthorized();

  try {
    const members = await workspaceService.listWorkspaceMembers({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId: getRequestedWorkspaceId(request),
    });
    return NextResponse.json(members);
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}

/**
 * POST /api/invites
 *
 * Creates an expiring workspace invitation. The raw token is returned once so
 * self-hosted installs can deliver it through their own channel.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseInviteBody(body);
  if ("response" in parsed) return parsed.response;

  try {
    const invitation = await workspaceService.createInvitation({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      workspaceId: getRequestedWorkspaceId(request),
      email: parsed.email,
      role: parsed.role,
      expiresAt: parsed.expiresAt,
    });
    return NextResponse.json(invitation, { status: 201 });
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}
