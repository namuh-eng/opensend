import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const [email] = await db
      .select({ attachments: emails.attachments })
      .from(emails)
      .where(and(eq(emails.id, id), eq(emails.userId, auth.userId)))
      .limit(1);

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const attachments =
      (email.attachments as Array<{
        id?: string;
        filename: string;
        content_type?: string;
      }>) ?? [];

    return NextResponse.json({
      object: "list",
      data: attachments.map((a, index) => ({
        id: a.id || `att-${index}`,
        filename: a.filename,
        content_type: a.content_type || "application/octet-stream",
      })),
    });
  } catch (error) {
    console.error("Failed to fetch email attachments:", error);
    return NextResponse.json(
      { error: "Failed to fetch email attachments" },
      { status: 500 },
    );
  }
}
