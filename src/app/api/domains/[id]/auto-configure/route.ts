import {
  authorizeDashboardOrApiKey,
  getServerSession,
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
import { DMARC_RECORD_VALUE, buildDmarcRecordName } from "@opensend/core";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeDashboardOrApiKey(
    _req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

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

    if (!domain || domain.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Legacy AWS_SES managed-DKIM path. BYO-DKIM domains publish a single
    // TXT record built into `domain.records` at create-time; auto-configure
    // for those should diff `domain.records` directly rather than re-call
    // SES. Tracked under issue #262 follow-ups.
    let dkimTokens: string[];
    try {
      const identity = await createDomainIdentity(domain.name);
      dkimTokens = identity.dkimTokens ?? [];
    } catch {
      const existing = await getCachedDomainIdentity(domain.name);
      dkimTokens = existing.dkimTokens;
    }

    const { records: cfRecords, warnings } = await autoConfigureDomain(
      domain.name,
      dkimTokens,
      domain.customReturnPath,
    );

    const configuredRecords = cfRecords.map((record) => ({
      type: record.type,
      name: record.name,
      value: record.content,
      status: "pending" as const,
      ttl: "Auto",
      ...(record.priority !== undefined ? { priority: record.priority } : {}),
    }));

    const existingRecords = (domain.records ?? []) as Array<{
      type: string;
      name: string;
      value: string;
      status: string;
      ttl: string;
      priority?: number;
    }>;
    const configuredKeys = new Set(
      configuredRecords.map((record) => `${record.type}:${record.name}`),
    );
    const allRecords = [
      ...existingRecords.filter(
        (record) => !configuredKeys.has(`${record.type}:${record.name}`),
      ),
      ...configuredRecords,
    ];

    const dmarcRecordName = buildDmarcRecordName(domain.name);
    const hasDmarcRecord = allRecords.some(
      (record) => record.type === "TXT" && record.name === dmarcRecordName,
    );
    if (!hasDmarcRecord) {
      allRecords.push({
        type: "TXT",
        name: dmarcRecordName,
        value: DMARC_RECORD_VALUE,
        status: "pending",
        ttl: "Auto",
      });
    }

    await db
      .update(domains)
      .set({
        records: allRecords,
        status: "pending",
      })
      .where(and(eq(domains.id, id), eq(domains.userId, userId)));

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
