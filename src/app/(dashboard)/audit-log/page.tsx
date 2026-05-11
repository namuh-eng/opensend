import { AuditLogListPage } from "@/components/audit-log-list-page";
import { getServerSession } from "@/lib/api-auth";
import { auditEventService } from "@opensend/core";
import { redirect } from "next/navigation";

export default async function AuditLogPage(props: {
  searchParams: Promise<{
    action?: string;
    targetType?: string;
    source?: string;
    after?: string;
    before?: string;
    q?: string;
    search?: string;
  }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const searchParams = await props.searchParams;
  const events = await auditEventService.listEvents({
    userId: session.user.id,
    limit: 500,
    action: searchParams.action,
    targetType: searchParams.targetType,
    source: searchParams.source,
    dateFrom: searchParams.after,
    dateTo: searchParams.before,
    search: searchParams.q || searchParams.search,
  });

  return (
    <AuditLogListPage
      events={events.map((event) => ({
        id: event.id,
        actorType: event.actorType,
        actorId: event.actorId,
        actorEmail: event.actorEmail,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        source: event.source,
        sourceApiKeyId: event.sourceApiKeyId,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      }))}
    />
  );
}
