import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { receivedEmails } from "@/lib/db/schema";
import { getPresignedUrl } from "@/lib/s3";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id, attachmentId } = await params;
    const [email] = await db
      .select({ attachments: receivedEmails.attachments })
      .from(receivedEmails)
      .where(eq(receivedEmails.id, id))
      .limit(1);

    if (!email) {
      return NextResponse.json(
        { error: "Received email not found" },
        { status: 404 },
      );
    }

    const attachments =
      (email.attachments as Array<{
        id: string;
        filename: string;
        contentType: string;
        size: number;
        s3Key: string;
      }>) ?? [];
    const attachment = attachments.find((a) => a.id === attachmentId);

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    // Generate S3 signed URL
    const downloadUrl = await getPresignedUrl(attachment.s3Key);

    return NextResponse.json({
      object: "received_email_attachment",
      id: attachment.id,
      filename: attachment.filename,
      content_type: attachment.contentType,
      size: attachment.size,
      download_url: downloadUrl,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch received email attachment:", error);
    return NextResponse.json(
      { error: "Failed to fetch received email attachment" },
      { status: 500 },
    );
  }
}
