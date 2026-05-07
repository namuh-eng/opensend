import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { getPresignedUrl } from "@/lib/s3";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id, attachmentId } = await params;
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
        contentType?: string;
        s3Key?: string;
        path?: string;
      }>) ?? [];
    const attachment = attachments.find(
      (a, index) => (a.id || `att-${index}`) === attachmentId,
    );

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    // Resolve S3 key - if stored as raw content, we might need a placeholder or real upload path
    const s3Key =
      attachment.s3Key ||
      attachment.path ||
      `sent-emails/${id}/${attachment.filename}`;
    const downloadUrl = await getPresignedUrl(s3Key);

    return NextResponse.json({
      object: "attachment",
      id: attachment.id || attachmentId,
      filename: attachment.filename,
      content_type: attachment.contentType || "application/octet-stream",
      download_url: downloadUrl,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch email attachment:", error);
    return NextResponse.json(
      { error: "Failed to fetch email attachment" },
      { status: 500 },
    );
  }
}
