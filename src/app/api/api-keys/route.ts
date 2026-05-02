import { createHash, randomUUID } from "node:crypto";
import {
  invalidateApiKeyAuthCache,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { checkApiKeyQuota, quotaExceededResponse } from "@/lib/billing/quota";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { and, desc, lt } from "drizzle-orm";

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || auth.permission !== "full_access") {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 20, 1),
    100,
  );
  const after = url.searchParams.get("after") || "";

  try {
    const conditions = [];
    if (after) {
      conditions.push(lt(apiKeys.id, after));
    }

    const results = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
      })
      .from(apiKeys)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(apiKeys.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const dataRows = hasMore ? results.slice(0, limit) : results;

    return Response.json({
      object: "list",
      data: dataRows.map((k) => ({
        id: k.id,
        name: k.name,
        created_at: k.createdAt,
        last_used_at: k.lastUsedAt,
      })),
      has_more: hasMore,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list API keys";
    return Response.json({ error: message }, { status: 500 });
  }
}

interface CreateApiKeyBody {
  name: string;
  permission?: "full_access" | "sending_access";
  domain_id?: string;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || auth.permission !== "full_access") {
    return unauthorizedResponse();
  }

  let body: CreateApiKeyBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || body.name.trim().length === 0) {
    return Response.json({ error: "name is required" }, { status: 422 });
  }

  if (body.name.trim().length > 50) {
    return Response.json(
      { error: "name must be 50 characters or less" },
      { status: 422 },
    );
  }

  try {
    const quota = await checkApiKeyQuota(auth.userId);
    if (!quota.ok) {
      return quotaExceededResponse(quota.info);
    }

    const rawKey = `re_${randomUUID().replace(/-/g, "")}`;
    const tokenHash = createHash("sha256").update(rawKey).digest("hex");
    const tokenPreview = `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}`;

    const [created] = await db
      .insert(apiKeys)
      .values({
        name: body.name.trim(),
        tokenHash,
        tokenPreview,
        permission: body.permission ?? "full_access",
        domain: body.domain_id ?? null,
        userId: auth.userId,
      })
      .returning();

    await invalidateApiKeyAuthCache(created.tokenHash);

    return Response.json(
      {
        id: created.id,
        token: rawKey,
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create API key";
    return Response.json({ error: message }, { status: 500 });
  }
}
