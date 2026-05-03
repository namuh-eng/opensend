import {
  getApiKeyAuthHeaderError,
  publicApiKeyUnauthorizedResponse,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { publicApiError, zodValidationDetails } from "@/lib/api-errors";
import {
  quotaExceededResponse,
  releaseEmailQuota,
  reserveEmailQuota,
} from "@/lib/billing/quota";
import { db } from "@/lib/db";
import { emails, templates } from "@/lib/db/schema";
import { normalizeAttachmentsForStorage } from "@/lib/email-attachments";
import { sendEmailSchema } from "@/lib/validation/emails";
import {
  createBackgroundJob,
  createTelemetryContext,
  emitCloudWatchMetric,
  getTelemetryCarrier,
  logTelemetry,
  publishBackgroundJob,
  recordTelemetryError,
} from "@opensend/core";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import type { ZodError } from "zod";

// ── Helpers ───────────────────────────────────────────────────────

function normalizeToArray(
  value: string | string[] | undefined,
): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

function jsonWithTelemetry(
  body: unknown,
  telemetry: ReturnType<typeof createTelemetryContext>,
  init?: ResponseInit,
): Response {
  const headers = new Headers(init?.headers);
  headers.set("x-correlation-id", telemetry.correlationId);
  headers.set("traceparent", telemetry.traceparent);
  return Response.json(body, { ...init, headers });
}

function recordAcceptMetric(
  telemetry: ReturnType<typeof createTelemetryContext>,
  input: {
    durationMs: number;
    outcome: "queued" | "scheduled" | "failed" | "unauthorized" | "invalid";
  },
): void {
  emitCloudWatchMetric(telemetry, {
    metrics: [
      { name: "EmailAccept", value: 1, unit: "Count" },
      {
        name: "EmailAcceptLatency",
        value: Math.round(input.durationMs),
        unit: "Milliseconds",
      },
    ],
    dimensions: {
      Service: "api",
      Operation: "email.accept",
      Outcome: input.outcome,
    },
  });
}

// ── POST /api/emails ──────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const telemetry = createTelemetryContext({
    service: "api",
    operation: "POST /api/emails",
    headers: request.headers,
  });
  const startedAt = performance.now();
  logTelemetry("info", "api.request.start", telemetry, {
    method: "POST",
    route: "/api/emails",
  });

  const authHeader = request.headers.get("authorization");
  const authHeaderError = getApiKeyAuthHeaderError(authHeader);
  const auth = authHeaderError ? null : await validateApiKey(authHeader);
  if (!auth) {
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "unauthorized",
    });
    return publicApiKeyUnauthorizedResponse(
      authHeaderError ?? "invalid_api_key",
      {
        headers: {
          "x-correlation-id": telemetry.correlationId,
          traceparent: telemetry.traceparent,
        },
      },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (
    idempotencyKey &&
    (idempotencyKey.length < 1 || idempotencyKey.length > 255)
  ) {
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return jsonWithTelemetry(
      publicApiError(
        "invalid_idempotency_key",
        "Idempotency-Key must be between 1 and 255 characters.",
        400,
      ),
      telemetry,
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return jsonWithTelemetry(
      publicApiError("invalid_json", "Request body must be valid JSON.", 400),
      telemetry,
      { status: 400 },
    );
  }

  const result = sendEmailSchema.safeParse(body);
  if (!result.success) {
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "invalid",
    });
    return jsonWithTelemetry(
      publicApiError(
        "validation_error",
        "Validation failed.",
        422,
        zodValidationDetails(result.error),
      ),
      telemetry,
      { status: 422 },
    );
  }

  const validated = result.data;

  // Idempotency check
  if (idempotencyKey) {
    const existing = await db.query.emails.findFirst({
      where: eq(emails.idempotencyKey, idempotencyKey),
    });
    if (existing) {
      recordAcceptMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "queued",
      });
      return jsonWithTelemetry(
        publicApiError(
          "idempotency_conflict",
          "A request with this idempotency key has already been accepted.",
          409,
          { id: existing.id },
        ),
        telemetry,
        { status: 409 },
      );
    }
  }

  const to = normalizeToArray(validated.to) as string[];
  const cc = normalizeToArray(validated.cc);
  const bcc = normalizeToArray(validated.bcc);
  const replyTo = normalizeToArray(validated.reply_to);
  const scheduledAt = validated.scheduled_at
    ? new Date(validated.scheduled_at)
    : null;

  let quotaReserved = false;
  try {
    let finalHtml = validated.html || "";
    let finalSubject = validated.subject;

    // Handle template resolving
    if (validated.template) {
      const template = await db.query.templates.findFirst({
        where: eq(templates.id, validated.template.id),
      });
      if (!template) {
        recordAcceptMetric(telemetry, {
          durationMs: performance.now() - startedAt,
          outcome: "invalid",
        });
        return jsonWithTelemetry(
          publicApiError("not_found", "Template not found.", 404),
          telemetry,
          { status: 404 },
        );
      }

      // Validate required variables
      const templateVars =
        (template.variables as Array<{
          name: string;
          required: boolean;
        }>) ?? [];
      const requiredVars = templateVars
        .filter((v) => v.required)
        .map((v) => v.name);
      const providedVars = validated.template.variables ?? {};

      for (const requiredVar of requiredVars) {
        if (providedVars[requiredVar] === undefined) {
          recordAcceptMetric(telemetry, {
            durationMs: performance.now() - startedAt,
            outcome: "invalid",
          });
          return jsonWithTelemetry(
            publicApiError(
              "validation_error",
              `Missing required template variable: ${requiredVar}`,
              422,
              {
                formErrors: [],
                fieldErrors: {
                  template: [`Missing required variable: ${requiredVar}`],
                },
              },
            ),
            telemetry,
            { status: 422 },
          );
        }
      }

      finalHtml = template.html || "";
      if (template.subject) finalSubject = template.subject;

      // Simple variable replacement
      if (validated.template.variables) {
        for (const [key, value] of Object.entries(
          validated.template.variables,
        )) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
          finalHtml = finalHtml.replace(regex, String(value));
          finalSubject = finalSubject.replace(regex, String(value));
        }
      }
    }

    const shouldQueueNow = !scheduledAt || scheduledAt <= new Date();

    // Quota gate: post-validation and committed in the same transaction as the
    // durable email row. SQS publish remains after commit so workers can read it.
    const email = await db.transaction(async (tx) => {
      const quota = await reserveEmailQuota(
        auth.userId,
        1,
        new Date(),
        process.env,
        tx,
      );
      if (!quota.ok) {
        return quota;
      }
      quotaReserved = !quota.bypassed;

      const [created] = await tx
        .insert(emails)
        .values({
          from: validated.from,
          to,
          cc: cc ?? [],
          bcc: bcc ?? [],
          replyTo: replyTo ?? [],
          subject: finalSubject,
          html: finalHtml,
          text: validated.text ?? "",
          tags: validated.tags ?? [],
          headers: (validated.headers as Record<string, string>) ?? {},
          attachments: normalizeAttachmentsForStorage(validated.attachments),
          status: shouldQueueNow ? "queued" : "scheduled",
          scheduledAt: scheduledAt,
          topicId: validated.topic_id || null,
          idempotencyKey: idempotencyKey,
          userId: auth.userId, // Link to the user who owns the API key
        })
        .returning({ id: emails.id });

      return { ok: true as const, email: created };
    });

    if (!email.ok) {
      logTelemetry("info", "email.quota_exceeded", telemetry, {
        plan: email.info.plan,
        limit: email.info.limit,
        used: email.info.used,
      });
      recordAcceptMetric(telemetry, {
        durationMs: performance.now() - startedAt,
        outcome: "invalid",
      });
      return quotaExceededResponse(email.info, {
        headers: {
          "x-correlation-id": telemetry.correlationId,
          traceparent: telemetry.traceparent,
        },
      });
    }

    const createdEmail = email.email;

    if (shouldQueueNow) {
      try {
        await publishBackgroundJob(
          createBackgroundJob({
            id: `email.send:${createdEmail.id}`,
            type: "email.send",
            source: "api",
            emailId: createdEmail.id,
            trace: getTelemetryCarrier(telemetry),
          }),
          {
            deduplicationId: `email.send:${createdEmail.id}`,
            groupId: "email.send",
          },
        );
      } catch (error) {
        await db
          .update(emails)
          .set({ status: "failed" })
          .where(eq(emails.id, createdEmail.id));
        recordTelemetryError(
          telemetry,
          "email.accept.queue_publish_failed",
          error,
          {
            email_id: createdEmail.id,
          },
        );
        throw error;
      }
    }

    const outcome = shouldQueueNow ? "queued" : "scheduled";
    const durationMs = performance.now() - startedAt;
    logTelemetry("info", "email.accepted", telemetry, {
      email_id: createdEmail.id,
      status: outcome,
      duration_ms: Math.round(durationMs),
    });
    recordAcceptMetric(telemetry, { durationMs, outcome });
    quotaReserved = false;
    return jsonWithTelemetry({ id: createdEmail.id }, telemetry);
  } catch (err) {
    recordTelemetryError(telemetry, "email.accept.failed", err);
    recordAcceptMetric(telemetry, {
      durationMs: performance.now() - startedAt,
      outcome: "failed",
    });
    if (quotaReserved) {
      await releaseEmailQuota(auth.userId, 1);
    }
    return jsonWithTelemetry(
      publicApiError("internal_server_error", "Failed to send email.", 500),
      telemetry,
      { status: 500 },
    );
  }
}

// ── GET /api/emails ───────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

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
        scheduledAt: emails.scheduledAt,
        sentAt: emails.sentAt,
        createdAt: emails.createdAt,
      })
      .from(emails);

    const conditions = [];
    if (status && status !== "all") {
      conditions.push(eq(emails.status, status));
    }
    if (after) {
      conditions.push(gt(emails.id, after));
    } else if (before) {
      conditions.push(lt(emails.id, before));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

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
  if (!auth) return unauthorizedResponse();

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Email id is required" }, { status: 400 });
  }

  try {
    await db.delete(emails).where(eq(emails.id, id));
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
