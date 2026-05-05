import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  const { id } = await params;

  try {
    const email = await db.query.emails.findFirst({
      where: and(eq(emails.id, id), eq(emails.userId, auth.userId)),
    });

    if (!email) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    return Response.json({
      object: "email",
      id: email.id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      cc: email.cc,
      bcc: email.bcc,
      reply_to: email.replyTo,
      last_event: email.status,
      scheduled_at: email.scheduledAt,
      sent_at: email.sentAt,
      tags: email.tags,
      created_at: email.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve email";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  const { id } = await params;

  let body: { scheduled_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const existing = await db.query.emails.findFirst({
      where: and(eq(emails.id, id), eq(emails.userId, auth.userId)),
    });

    if (!existing) {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    if (existing.status !== "scheduled") {
      return Response.json(
        { error: `Cannot update a ${existing.status} email` },
        { status: 400 },
      );
    }

    const updates: { scheduledAt?: Date | null } = {};
    if (body.scheduled_at !== undefined) {
      updates.scheduledAt = body.scheduled_at
        ? new Date(body.scheduled_at)
        : null;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(emails)
      .set(updates)
      .where(and(eq(emails.id, id), eq(emails.userId, auth.userId)))
      .returning();

    return Response.json({
      object: "email",
      id: updated.id,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update email";
    return Response.json({ error: message }, { status: 500 });
  }
}
