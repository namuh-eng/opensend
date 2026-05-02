import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { checkDomainQuota, quotaExceededResponse } from "@/lib/billing/quota";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { invalidateDomainCaches } from "@/lib/domain-cache";
import { createDomainIdentity } from "@/lib/ses";
import { createDomainSchema } from "@/lib/validation/domains";
import { and, desc, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

const defaultCapabilities = [
  { name: "sending", enabled: true },
  { name: "receiving", enabled: false },
];

export async function POST(request: Request) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createDomainSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const validated = result.data;
    const domainName = validated.name.toLowerCase();

    const quota = await checkDomainQuota(auth.userId);
    if (!quota.ok) {
      return quotaExceededResponse(quota.info);
    }

    const identity = await createDomainIdentity(domainName);

    const dkimRecords = identity.dkimTokens.map((token) => ({
      type: "CNAME",
      name: `${token}._domainkey.${domainName}`,
      value: `${token}.dkim.amazonses.com`,
      status: "pending" as const,
      ttl: "Auto",
    }));

    const spfRecord = {
      type: "TXT",
      name: domainName,
      value: "v=spf1 include:amazonses.com ~all",
      status: "pending" as const,
      ttl: "Auto",
    };

    const mxRecord = {
      type: "MX",
      name: domainName,
      value: `feedback-smtp.${validated.region}.amazonses.com`,
      status: "pending" as const,
      ttl: "Auto",
      priority: 10,
    };

    const allRecords = [...dkimRecords, spfRecord, mxRecord];

    const [row] = await db
      .insert(domains)
      .values({
        name: domainName,
        region: validated.region,
        status: "not_started",
        dkimTokens: identity.dkimTokens,
        records: allRecords,
        customReturnPath: validated.custom_return_path || null,
        trackOpens: validated.open_tracking ?? false,
        trackClicks: validated.click_tracking ?? false,
        trackingSubdomain: validated.tracking_subdomain || null,
        tls: validated.tls,
        capabilities: validated.capabilities || defaultCapabilities,
        userId: auth.userId,
      })
      .returning();

    await invalidateDomainCaches({ id: row.id, name: row.name });

    return NextResponse.json(
      {
        object: "domain",
        id: row.id,
        name: row.name,
        status: row.status,
        region: row.region,
        records: row.records || [],
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
    console.error("Failed to create domain:", error);
    return NextResponse.json(
      { error: "Failed to create domain" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 20, 1),
    100,
  );
  const after = url.searchParams.get("after") || "";

  try {
    const conditions = [];
    if (after) {
      conditions.push(lt(domains.id, after));
    }

    const results = await db
      .select()
      .from(domains)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(domains.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const rows = hasMore ? results.slice(0, limit) : results;

    return NextResponse.json({
      object: "list",
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        region: r.region,
        capabilities: r.capabilities,
        created_at: r.createdAt,
      })),
      has_more: hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch domains:", error);
    return NextResponse.json(
      { error: "Failed to fetch domains" },
      { status: 500 },
    );
  }
}
