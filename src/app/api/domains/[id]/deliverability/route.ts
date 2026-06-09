import { resolveTxt } from "node:dns/promises";
import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { domainRouteParamsSchema } from "@/lib/validation/domains";
import {
  type DnsTxtRecordSet,
  domainDeliverabilityStatusRepo,
  evaluateBimiReadiness,
} from "@opensend/core";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const appleBrandedMailStatuses = [
  "not_started",
  "requested",
  "approved",
  "rejected",
  "manual_review",
] as const;

const updateDeliverabilitySchema = z.object({
  bimi_selector: z.string().min(1).max(63).optional(),
  bimi_logo_url: z.string().url().nullable().optional(),
  bimi_certificate_url: z.string().url().nullable().optional(),
  bimi_notes: z.string().max(4000).nullable().optional(),
  apple_branded_mail_status: z.enum(appleBrandedMailStatuses).optional(),
  apple_branded_mail_notes: z.string().max(4000).nullable().optional(),
});

async function resolveUserId(req: Request): Promise<string | Response> {
  const auth = await authorizeDashboardOrApiKey(
    req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;

  if ("dashboard" in auth) {
    const session = await getServerSession();
    if (!session?.user?.id) return unauthorizedResponse();
    return session.user.id;
  }

  if ("userId" in auth && auth.userId) return auth.userId;
  return unauthorizedResponse();
}

async function loadDomainForUser(domainId: string, userId: string) {
  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, domainId), eq(domains.userId, userId)))
    .limit(1);
  return domain;
}

function dnsValuesFromDomainRecords(
  recordName: string,
  records: Array<{ type: string; name: string; value: string }> | null,
): string[] {
  const normalizedRecordName = recordName.toLowerCase();
  return (records ?? [])
    .filter(
      (record) =>
        record.type.toUpperCase() === "TXT" &&
        record.name.toLowerCase() === normalizedRecordName,
    )
    .map((record) => record.value);
}

async function readTxtRecords(
  recordName: string,
  records: Array<{ type: string; name: string; value: string }> | null,
): Promise<DnsTxtRecordSet> {
  const fallbackValues = dnsValuesFromDomainRecords(recordName, records);
  if (fallbackValues.length > 0) {
    return { name: recordName, values: fallbackValues };
  }

  try {
    const resolved = await resolveTxt(recordName);
    const values = resolved.map((chunks) => chunks.join(""));
    return {
      name: recordName,
      values: values.length > 0 ? values : fallbackValues,
    };
  } catch (error) {
    return {
      name: recordName,
      values: fallbackValues,
      error: error instanceof Error ? error.message : "DNS TXT lookup failed",
    };
  }
}

function deliverabilityResponse(
  status: Awaited<
    ReturnType<typeof domainDeliverabilityStatusRepo.ensureForDomain>
  >,
  bimi: ReturnType<typeof evaluateBimiReadiness>,
) {
  return {
    object: "domain_deliverability_status",
    id: status.id,
    domain_id: status.domainId,
    bimi: {
      status: bimi.status,
      selector: bimi.selector,
      record_name: bimi.bimiRecordName,
      logo_url: bimi.logoUrl,
      certificate_url: bimi.certificateUrl,
      notes: status.bimiNotes,
      checks: bimi.checks,
      dns: bimi.dns,
    },
    apple_branded_mail: {
      status: status.appleBrandedMailStatus,
      notes: status.appleBrandedMailNotes,
      mode: "operator_notes_only",
    },
    last_checked_at: status.lastCheckedAt,
    created_at: status.createdAt,
    updated_at: status.updatedAt,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const domain = await loadDomainForUser(parsedParams.data.id, userId);
  if (!domain)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = await domainDeliverabilityStatusRepo.ensureForDomain(
    domain.id,
    userId,
  );
  const selector = status.bimiSelector || "default";
  const dmarcRecordName = `_dmarc.${domain.name}`;
  const bimiRecordName = `${selector}._bimi.${domain.name}`;
  const dmarcTxt = await readTxtRecords(
    dmarcRecordName,
    domain.records ?? null,
  );
  const bimiTxt = await readTxtRecords(bimiRecordName, domain.records ?? null);
  const bimi = evaluateBimiReadiness({
    domainName: domain.name,
    selector,
    dmarcTxt,
    bimiTxt,
    configuredLogoUrl: status.bimiLogoUrl,
    configuredCertificateUrl: status.bimiCertificateUrl,
  });

  const checkedStatus =
    (await domainDeliverabilityStatusRepo.updateForDomain(domain.id, userId, {
      bimiStatus: bimi.status,
      lastCheckedAt: new Date(),
    })) ?? status;

  return NextResponse.json(deliverabilityResponse(checkedStatus, bimi));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const domain = await loadDomainForUser(parsedParams.data.id, userId);
  if (!domain)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateDeliverabilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  await domainDeliverabilityStatusRepo.ensureForDomain(domain.id, userId);
  const updated = await domainDeliverabilityStatusRepo.updateForDomain(
    domain.id,
    userId,
    {
      bimiSelector: parsed.data.bimi_selector,
      bimiLogoUrl: parsed.data.bimi_logo_url,
      bimiCertificateUrl: parsed.data.bimi_certificate_url,
      bimiNotes: parsed.data.bimi_notes,
      appleBrandedMailStatus: parsed.data.apple_branded_mail_status,
      appleBrandedMailNotes: parsed.data.apple_branded_mail_notes,
    },
  );

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dmarcRecordName = `_dmarc.${domain.name}`;
  const bimiRecordName = `${updated.bimiSelector}._bimi.${domain.name}`;
  const bimi = evaluateBimiReadiness({
    domainName: domain.name,
    selector: updated.bimiSelector,
    dmarcTxt: {
      name: dmarcRecordName,
      values: dnsValuesFromDomainRecords(
        dmarcRecordName,
        domain.records ?? null,
      ),
    },
    bimiTxt: {
      name: bimiRecordName,
      values: dnsValuesFromDomainRecords(
        bimiRecordName,
        domain.records ?? null,
      ),
    },
    configuredLogoUrl: updated.bimiLogoUrl,
    configuredCertificateUrl: updated.bimiCertificateUrl,
  });

  return NextResponse.json(deliverabilityResponse(updated, bimi));
}
