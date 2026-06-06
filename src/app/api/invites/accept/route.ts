import { auth } from "@/lib/auth";
import { mapWorkspaceServiceError } from "@/lib/workspace-route-auth";
import { workspaceService } from "@opensend/core";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(accepted);
  } catch (error) {
    return mapWorkspaceServiceError(error);
  }
}
