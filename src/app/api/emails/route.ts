import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { zodValidationDetails } from "@/lib/api-errors";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { handlePostEmailRequest } from "@/lib/api/emails/send";
import { createEmailReadService } from "@opensend/core";
import type { ZodError } from "zod";

const emailReadService = createEmailReadService();

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
  const limit = Number(url.searchParams.get("limit")) || 20;
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const status = (
    url.searchParams.get("status") ??
    url.searchParams.get("statuses") ??
    ""
  ).trim();

  try {
    const result = await emailReadService.listEmails({
      userId: auth.userId,
      limit,
      after: after ?? undefined,
      before: before ?? undefined,
      status,
    });
    return Response.json(result);
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
    const result = await emailReadService.deleteEmail(auth.userId, id);
    return Response.json(result);
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
