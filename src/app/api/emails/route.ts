import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { zodValidationDetails } from "@/lib/api-errors";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { handlePostEmailRequest } from "@/lib/api/emails/send";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { type SQL, and, desc, eq, gt, lt } from "drizzle-orm";
import type { ZodError } from "zod";

// ── POST /api/emails ──────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  return handlePostEmailRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 20, 1),
    100,
  );
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const status = (
    url.searchParams.get("status") ??
    url.searchParams.get("statuses") ??
    ""
  ).trim();

  try {
    let query = db
      .select({
        id: emails.id,
        from: emails.from,
        to: emails.to,
        subject: emails.subject,
        cc: emails.cc,
        bcc: emails.bcc,
        replyTo: emails.replyTo,
        status: emails.status,
        providerRetryCount: emails.providerRetryCount,
        providerLastAttemptedAt: emails.providerLastAttemptedAt,
        providerNextRetryAt: emails.providerNextRetryAt,
        providerLastErrorCode: emails.providerLastErrorCode,
        providerLastErrorMessage: emails.providerLastErrorMessage,
        providerDeadLetteredAt: emails.providerDeadLetteredAt,
        scheduledAt: emails.scheduledAt,
        sentAt: emails.sentAt,
        createdAt: emails.createdAt,
      })
      .from(emails);

    const conditions: SQL[] = [eq(emails.userId, auth.userId)];
    if (status && status !== "all") {
      conditions.push(eq(emails.status, status));
    }
    if (after) {
      conditions.push(gt(emails.id, after));
    } else if (before) {
      conditions.push(lt(emails.id, before));
    }
    query = query.where(and(...conditions)) as typeof query;

    const results = await query
      .orderBy(desc(emails.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return Response.json({
      object: "list",
      has_more: hasMore,
      data: data.map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        subject: e.subject,
        cc: e.cc,
        bcc: e.bcc,
        reply_to: e.replyTo,
        last_event: e.status,
        provider_retry_count: e.providerRetryCount,
        provider_last_attempted_at: e.providerLastAttemptedAt,
        provider_next_retry_at: e.providerNextRetryAt,
        provider_last_error: e.providerLastErrorCode
          ? {
              code: e.providerLastErrorCode,
              message: e.providerLastErrorMessage ?? "Provider send failed.",
            }
          : null,
        provider_dead_lettered_at: e.providerDeadLetteredAt,
        scheduled_at: e.scheduledAt,
        sent_at: e.sentAt,
        created_at: e.createdAt,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list emails";
    return Response.json({ error: message }, { status: 500 });
  }
}

// ── DELETE /api/emails ────────────────────────────────────────────

export async function DELETE(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Email id is required" }, { status: 400 });
  }

  try {
    await db
      .delete(emails)
      .where(and(eq(emails.id, id), eq(emails.userId, auth.userId)));
    return Response.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete email";
    return Response.json({ error: message }, { status: 500 });
  }
}

// Error fallback for Zod (kept explicit for strict typing in route handlers)
export function formatZodError(error: ZodError): Record<string, unknown> {
  return zodValidationDetails(error);
}
