import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import {
  SUPPRESSION_EXPORT_LIMIT,
  type SuppressionReason,
  SuppressionServiceError,
  createSuppressionService,
} from "@opensend/core";
import { z } from "zod";

const createSuppressionSchema = z.object({
  email: z.string().email().min(3).max(512),
  reason: z.enum(["bounced", "complained", "manual"]).optional(),
});

const importJsonSchema = z.object({
  csv: z.string().min(1),
});

const suppressionService = createSuppressionService();

function toSuppressionReason(
  value: string | undefined,
): SuppressionReason | undefined {
  return value === "bounced" || value === "complained" || value === "manual"
    ? value
    : undefined;
}

function toSuppressionSource(
  value: string | undefined,
): "manual" | "operator" | "ses" | undefined {
  return value === "manual" || value === "operator" || value === "ses"
    ? value
    : undefined;
}

type SuppressionAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

async function requireSuppressionAuth(
  request: Request,
): Promise<SuppressionAuthResult> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return { ok: false, response: unauthorizedResponse() };

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return { ok: false, response: permissionError };

  if ("userId" in auth) {
    if (!auth.userId) return { ok: false, response: unauthorizedResponse() };
    return { ok: true, userId: auth.userId };
  }

  const session = await getServerSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, response: unauthorizedResponse() };

  return { ok: true, userId };
}

function parseDate(value: string | null, boundary: "start" | "end") {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999";
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function searchParam(
  params: URLSearchParams,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return undefined;
}

function suppressionFiltersFromParams(params: URLSearchParams) {
  const reason = searchParam(params, "reason", "status");
  const source = searchParam(params, "source");
  return {
    search: searchParam(params, "email", "search", "q"),
    reason: toSuppressionReason(reason),
    source: toSuppressionSource(source),
    createdAfter: parseDate(
      searchParam(params, "created_after", "createdAfter") ?? null,
      "start",
    ),
    createdBefore: parseDate(
      searchParam(params, "created_before", "createdBefore") ?? null,
      "end",
    ),
    domain: searchParam(params, "domain"),
    topicId: searchParam(params, "topic_id", "topicId"),
  };
}

async function readImportCsv(
  request: Request,
): Promise<{ ok: true; csv: string } | { ok: false; response: Response }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return {
        ok: false,
        response: Response.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        ),
      };
    }

    const parsed = importJsonSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        response: Response.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 422 },
        ),
      };
    }
    return { ok: true, csv: parsed.data.csv };
  }

  const csv = await request.text();
  if (!csv.trim()) {
    return {
      ok: false,
      response: Response.json(
        { error: "CSV body is required", code: "empty_csv" },
        { status: 422 },
      ),
    };
  }
  return { ok: true, csv };
}

export async function handleListSuppressionsRequest(
  request: Request,
): Promise<Response> {
  const authResult = await requireSuppressionAuth(request);
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit"));
  const after = url.searchParams.get("after") || undefined;

  const result = await suppressionService.listSuppressions({
    userId: authResult.userId,
    limit,
    after,
    ...suppressionFiltersFromParams(url.searchParams),
  });

  return Response.json(result);
}

export async function handleDeleteSuppressionRequest(
  request: Request,
  email: string,
): Promise<Response> {
  const authResult = await requireSuppressionAuth(request);
  if (!authResult.ok) return authResult.response;

  const decodedEmail = decodeURIComponent(email);

  try {
    const deleted = await suppressionService.deleteSuppression(
      authResult.userId,
      decodedEmail,
    );
    return Response.json(deleted);
  } catch (err) {
    if (err instanceof SuppressionServiceError && err.code === "not_found") {
      return Response.json(
        { error: "Suppression not found", code: "not_found" },
        { status: 404 },
      );
    }
    throw err;
  }
}

export async function handleCreateSuppressionRequest(
  request: Request,
): Promise<Response> {
  const authResult = await requireSuppressionAuth(request);
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createSuppressionSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const created = await suppressionService.createSuppression({
    userId: authResult.userId,
    email: result.data.email,
    reason: result.data.reason,
  });

  return Response.json(created, { status: 201 });
}

export async function handleImportSuppressionsRequest(
  request: Request,
): Promise<Response> {
  const authResult = await requireSuppressionAuth(request);
  if (!authResult.ok) return authResult.response;

  const csvResult = await readImportCsv(request);
  if (!csvResult.ok) return csvResult.response;

  const imported = await suppressionService.importSuppressions({
    userId: authResult.userId,
    csv: csvResult.csv,
  });

  return Response.json(imported, {
    status: imported.errors.length > 0 ? 422 : 201,
  });
}

export async function handleExportSuppressionsRequest(
  request: Request,
): Promise<Response> {
  const authResult = await requireSuppressionAuth(request);
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const limit =
    Number(url.searchParams.get("limit")) || SUPPRESSION_EXPORT_LIMIT;

  try {
    const exported = await suppressionService.exportSuppressions({
      userId: authResult.userId,
      limit,
      after: url.searchParams.get("after") || undefined,
      ...suppressionFiltersFromParams(url.searchParams),
    });

    const today = new Date().toISOString().slice(0, 10);
    return new Response(exported.csv, {
      status: 200,
      headers: {
        "content-type": "text/csv;charset=utf-8",
        "content-disposition": `attachment; filename="suppressions-${today}.csv"`,
        "x-opensend-export-rows": String(exported.row_count),
        "x-opensend-export-limit": String(exported.limit),
      },
    });
  } catch (err) {
    if (
      err instanceof SuppressionServiceError &&
      err.code === "export_too_large"
    ) {
      return Response.json(
        {
          error: err.message,
          code: "export_too_large",
          limit,
        },
        { status: 413 },
      );
    }
    throw err;
  }
}
