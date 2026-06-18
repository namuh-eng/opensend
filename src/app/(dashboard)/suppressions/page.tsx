import {
  type SuppressionDashboardRow,
  SuppressionsListPage,
} from "@/components/suppressions-list-page";
import { getServerSession } from "@/lib/api-auth";
import { createSuppressionService } from "@opensend/core";
import { redirect } from "next/navigation";

type SuppressionsSearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SuppressionsSearchParams>;
};

const suppressionService = createSuppressionService();

function getParam(params: SuppressionsSearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseDate(value: string, boundary: "start" | "end"): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === "start" ? "T00:00:00.000" : "T23:59:59.999";
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toReason(value: string) {
  return value === "bounced" || value === "complained" || value === "manual"
    ? value
    : null;
}

function toSource(value: string) {
  return value === "manual" || value === "operator" || value === "ses"
    ? value
    : null;
}

export default async function SuppressionsPage({
  searchParams,
}: PageProps = {}) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect("/auth");

  const resolved = searchParams ? await searchParams : {};
  const result = await suppressionService.listSuppressions({
    userId: session.user.id,
    limit: 100,
    search: getParam(resolved, "q") || getParam(resolved, "search") || null,
    reason: toReason(getParam(resolved, "reason")),
    source: toSource(getParam(resolved, "source")),
    createdAfter: parseDate(getParam(resolved, "created_after"), "start"),
    createdBefore: parseDate(getParam(resolved, "created_before"), "end"),
    domain: getParam(resolved, "domain") || null,
    topicId: getParam(resolved, "topic_id") || null,
  });

  const suppressions: SuppressionDashboardRow[] = result.data.map((row) => ({
    id: row.id,
    email: row.email,
    reason: row.reason,
    source: row.metadata?.source ?? "",
    sourceEmailId: row.source_email_id,
    sourceMessageId: row.source_message_id,
    suppressedAt: row.suppressed_at,
    updatedAt: row.updated_at,
  }));

  return <SuppressionsListPage suppressions={suppressions} />;
}
