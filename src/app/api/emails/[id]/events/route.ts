import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emailEvents, emails } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  try {
    const { id: emailId } = await params;
    const email = await db.query.emails.findFirst({
      where: and(eq(emails.id, emailId), eq(emails.userId, auth.userId)),
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const results = await db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.emailId, emailId))
      .orderBy(asc(emailEvents.receivedAt));

    return NextResponse.json({
      object: "list",
      data: results.map((e) => ({
        object: "email_event",
        id: e.id,
        type: e.type,
        payload: e.payload,
        created_at: e.receivedAt,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch email events:", error);
    return NextResponse.json(
      { error: "Failed to fetch email events" },
      { status: 500 },
    );
  }
}
