import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { receivedEmails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const [email] = await db
      .select()
      .from(receivedEmails)
      .where(eq(receivedEmails.id, id))
      .limit(1);

    if (!email) {
      return NextResponse.json(
        { error: "Received email not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      object: "received_email",
      id: email.id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      created_at: email.createdAt,
    });
  } catch (error) {
    console.error("Failed to fetch received email:", error);
    return NextResponse.json(
      { error: "Failed to fetch received email" },
      { status: 500 },
    );
  }
}
