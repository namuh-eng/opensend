import {
  authorizeDashboardOrApiKey,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { autoConfigureDomain } from "@/lib/cloudflare";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import {
  getCachedDomainById,
  getCachedDomainIdentity,
  invalidateDomainCaches,
} from "@/lib/domain-cache";
import { createDomainIdentity } from "@/lib/ses";
import { autoConfigureDomainParamsSchema } from "@/lib/validation/domains";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeDashboardOrApiKey(
    _req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const parsedParams = autoConfigureDomainParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedParams.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = parsedParams.data;

  try {
    const domain = await getCachedDomainById(id);

    if (!domain) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let dkimTokens: string[];
    try {
      const identity = await createDomainIdentity(domain.name);
      dkimTokens = identity.dkimTokens;
    } catch {
      const existing = await getCachedDomainIdentity(domain.name);
      dkimTokens = existing.dkimTokens;
    }

    const { records: cfRecords, warnings } = await autoConfigureDomain(
      domain.name,
      dkimTokens,
    );

    const allRecords = cfRecords.map((record) => ({
      type: record.type,
      name: record.name,
      value: record.content,
      status: "pending" as const,
      ttl: "Auto",
      ...(record.priority !== undefined ? { priority: record.priority } : {}),
    }));

    await db
      .update(domains)
      .set({
        records: allRecords,
        status: "pending",
      })
      .where(eq(domains.id, id));

    await invalidateDomainCaches({ id, name: domain.name });

    return NextResponse.json({
      ok: true,
      records: allRecords,
      cloudflare_records: cfRecords.length,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Auto-configure failed", details: message },
      { status: 500 },
    );
  }
}
