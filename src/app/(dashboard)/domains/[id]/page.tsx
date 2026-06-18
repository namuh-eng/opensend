import { DomainDetail } from "@/components/domain-detail";
import { getServerSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import { domainRouteParamsSchema } from "@/lib/validation/domains";
import {
  domainDeliverabilityStatusRepo,
  evaluateBimiReadiness,
} from "@opensend/core";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

interface DomainEvent {
  type: string;
  timestamp: string;
}

function txtValuesFromRecords(
  recordName: string,
  records:
    | Array<{
        type: string;
        name: string;
        value: string;
        status: string;
        ttl: string;
      }>
    | null
    | undefined,
): string[] {
  const normalized = recordName.toLowerCase();
  return (records ?? [])
    .filter(
      (record) =>
        record.type.toUpperCase() === "TXT" &&
        record.name.toLowerCase() === normalized,
    )
    .map((record) => record.value);
}

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/auth");
  }
  const userId = session.user.id;

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    notFound();
  }

  const { id } = parsedParams.data;

  const rows = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    notFound();
  }

  const domain = rows[0];

  const events: DomainEvent[] = [];
  events.push({
    type: "domain_added",
    timestamp: domain.createdAt.toISOString(),
  });

  if (
    domain.status === "verified" ||
    domain.status === "pending" ||
    domain.status === "temporary_failure"
  ) {
    const dnsTime = new Date(domain.createdAt.getTime() + 60000);
    events.push({
      type: "dns_verified",
      timestamp: dnsTime.toISOString(),
    });
  }

  if (domain.status === "verified") {
    const verifiedTime = new Date(domain.createdAt.getTime() + 120000);
    events.push({
      type: "domain_verified",
      timestamp: verifiedTime.toISOString(),
    });
  }

  const deliverabilityStatus =
    await domainDeliverabilityStatusRepo.ensureForDomain(domain.id, userId);
  const bimiSelector = deliverabilityStatus.bimiSelector || "default";
  const dmarcRecordName = `_dmarc.${domain.name}`;
  const bimiRecordName = `${bimiSelector}._bimi.${domain.name}`;
  const bimiReadiness = evaluateBimiReadiness({
    domainName: domain.name,
    selector: bimiSelector,
    dmarcTxt: {
      name: dmarcRecordName,
      values: txtValuesFromRecords(dmarcRecordName, domain.records),
    },
    bimiTxt: {
      name: bimiRecordName,
      values: txtValuesFromRecords(bimiRecordName, domain.records),
    },
    configuredLogoUrl: deliverabilityStatus.bimiLogoUrl,
    configuredCertificateUrl: deliverabilityStatus.bimiCertificateUrl,
  });

  return (
    <DomainDetail
      domain={{
        id: domain.id,
        name: domain.name,
        status: domain.status,
        region: domain.region,
        createdAt: domain.createdAt.toISOString(),
        clickTracking: domain.trackClicks,
        openTracking: domain.trackOpens,
        trackingSubdomain: domain.trackingSubdomain,
        tls: domain.tls,
        sendingEnabled: Boolean(
          domain.capabilities?.some(
            (capability) => capability.name === "sending" && capability.enabled,
          ) ?? true,
        ),
        receivingEnabled: Boolean(
          domain.capabilities?.some(
            (capability) =>
              capability.name === "receiving" && capability.enabled,
          ),
        ),
        records: domain.records ?? null,
        events,
        deliverability: {
          bimi: {
            status: bimiReadiness.status,
            selector: bimiReadiness.selector,
            recordName: bimiReadiness.bimiRecordName,
            logoUrl: bimiReadiness.logoUrl,
            certificateUrl: bimiReadiness.certificateUrl,
            checks: bimiReadiness.checks,
            notes: deliverabilityStatus.bimiNotes,
          },
          appleBrandedMail: {
            status: deliverabilityStatus.appleBrandedMailStatus,
            notes: deliverabilityStatus.appleBrandedMailNotes,
          },
          lastCheckedAt:
            deliverabilityStatus.lastCheckedAt?.toISOString() ?? null,
        },
      }}
    />
  );
}
