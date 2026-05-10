import { auth } from "@/lib/auth";
import { createInvitesService } from "@opensend/core";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const invitesService = createInvitesService();

/**
 * GET /api/invites
 *
 * Lists members of the current user's organization.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const members = await invitesService.listMembers();
    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
