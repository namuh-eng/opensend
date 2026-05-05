import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { checkDomainQuota, quotaExceededResponse } from "@/lib/billing/quota";
import { invalidateDomainCaches } from "@/lib/domain-cache";
import { createDomainIdentity } from "@/lib/ses";
import { createDomainSchema } from "@/lib/validation/domains";
import {
  createDomainService,
  getEffectiveReturnPathLabel,
} from "@opensend/core";

function domainService() {
  return createDomainService({
    createDomainIdentity,
    invalidateDomainCaches,
  });
}

function mapDomainError(error: unknown, fallback: string): Response {
  console.error(`${fallback}:`, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createDomainSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const quota = await checkDomainQuota(auth.userId);
    if (!quota.ok) {
      return quotaExceededResponse(quota.info);
    }

    const validated = result.data;
    const row = await domainService().createDomain({
      name: validated.name,
      region: validated.region,
      customReturnPath: validated.custom_return_path,
      openTracking: validated.open_tracking,
      clickTracking: validated.click_tracking,
      trackingSubdomain: validated.tracking_subdomain,
      tls: validated.tls,
      capabilities: validated.capabilities,
      userId: auth.userId,
    });

    return Response.json(
      {
        object: "domain",
        id: row.id,
        name: row.name,
        status: row.status,
        region: row.region,
        records: row.records || [],
        custom_return_path: row.customReturnPath,
        return_path: getEffectiveReturnPathLabel(row.customReturnPath),
        open_tracking: row.trackOpens,
        click_tracking: row.trackClicks,
        tracking_subdomain: row.trackingSubdomain,
        tls: row.tls,
        capabilities: row.capabilities,
        created_at: row.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return mapDomainError(error, "Failed to create domain");
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 20;
  const after = url.searchParams.get("after") || "";

  try {
    const result = await domainService().listDomains({
      limit,
      after,
      userId,
    });

    return Response.json({
      object: "list",
      data: result.data.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        region: r.region,
        capabilities: r.capabilities,
        created_at: r.createdAt,
      })),
      has_more: result.hasMore,
    });
  } catch (error) {
    return mapDomainError(error, "Failed to fetch domains");
  }
}
