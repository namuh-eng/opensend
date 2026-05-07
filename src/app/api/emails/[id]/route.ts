import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { publicApiError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import {
  parseScheduledAt,
  scheduledAtValidationMessage,
} from "@/lib/validation/emails";
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
      provider_retry_count: email.providerRetryCount,
      provider_last_attempted_at: email.providerLastAttemptedAt,
      provider_next_retry_at: email.providerNextRetryAt,
      provider_last_error: email.providerLastErrorCode
        ? {
            code: email.providerLastErrorCode,
            message: email.providerLastErrorMessage ?? "Provider send failed.",
          }
        : null,
      provider_dead_lettered_at: email.providerDeadLetteredAt,
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

function scheduledAtValidationResponse(): Response {
  return Response.json(
    publicApiError("validation_error", "Validation failed.", 422, {
      formErrors: [],
      fieldErrors: {
        scheduled_at: [scheduledAtValidationMessage],
      },
    }),
    { status: 422 },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return scheduledAtValidationResponse();
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
    if ("scheduled_at" in body) {
      const scheduledAt = body.scheduled_at;
      if (scheduledAt === null) {
        updates.scheduledAt = null;
      } else if (typeof scheduledAt === "string") {
        const parsed = parseScheduledAt(scheduledAt);
        if (!parsed.ok) return scheduledAtValidationResponse();
        updates.scheduledAt = parsed.date;
      } else {
        return scheduledAtValidationResponse();
      }
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
