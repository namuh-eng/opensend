import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;

    const existing = await db.query.emails.findFirst({
      where: and(eq(emails.id, id), eq(emails.userId, auth.userId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (existing.status !== "scheduled") {
      return NextResponse.json(
        { error: `Cannot cancel a ${existing.status} email` },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(emails)
      .set({ status: "canceled" })
      .where(and(eq(emails.id, id), eq(emails.userId, auth.userId)))
      .returning();

    return NextResponse.json({
      object: "email",
      id: updated.id,
      status: "canceled",
    });
  } catch (error) {
    console.error("Failed to cancel email:", error);
    return NextResponse.json(
      { error: "Failed to cancel email" },
      { status: 500 },
    );
  }
}
