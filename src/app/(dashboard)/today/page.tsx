import {
  Card,
  PageHeader,
  Pill,
  SectionHeader,
  StatCard,
} from "@/components/ui-new";
import { getServerSession } from "@/lib/api-auth";
import {
  dashboardMetricStateLabel,
  getOpenTrackingMetricState,
  getProviderFeedbackMetricState,
} from "@/lib/dashboard-deliverability-state";
import {
  type ProviderFeedbackCandidate,
  areAllRecentSenderDomainsWired,
  resolveProviderFeedbackWiring,
} from "@/lib/dashboard-provider-feedback";
import { db } from "@/lib/db";
import { domains, emailEvents, emails } from "@/lib/db/schema";
import {
  getTodayApiBaseUrl,
  getTodayChartSummary,
} from "@/lib/today-dashboard";
import { desc, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const RECENT_SENDER_DOMAIN_LIMIT = 50;

type StatusKind = "verified" | "pending" | "warning";
type HourBucket = {
  sent: number;
  delivered: number;
  opened: number;
  bounced: number;
};

type TodayStats = {
  total: number;
  delivered: number;
  opened: number;
  bounced: number;
  openTrackingEnabled: boolean;
};

async function loadStats(userId: string): Promise<TodayStats> {
  const since = new Date(Date.now() - 24 * HOUR_MS);
  try {
    const result = await db.execute(sql`
      SELECT
        count(distinct e.id)::int AS total,
        count(distinct e.id) FILTER (WHERE ev.type = 'delivered')::int AS delivered,
        count(distinct e.id) FILTER (WHERE ev.type = 'opened')::int AS opened,
        count(distinct e.id) FILTER (WHERE ev.type = 'bounced')::int AS bounced,
        exists (
          SELECT 1
          FROM ${domains} d
          JOIN ${emails} se
            ON se.user_id = d.user_id
           AND (
             lower(se.from) LIKE '%@' || lower(d.name)
             OR lower(se.from) LIKE '%@' || lower(d.name) || '>'
           )
          WHERE d.user_id = ${userId}
            AND d.track_opens = true
            AND se.created_at >= ${since}
        ) AS open_tracking_enabled
      FROM ${emails} e
      LEFT JOIN ${emailEvents} ev ON ev.email_id = e.id
      WHERE e.user_id = ${userId} AND e.created_at >= ${since}
    `);
    const rows = ((result as unknown as { rows?: unknown[] }).rows ??
      result) as unknown[];
    const row = (rows as Array<Record<string, unknown>>)[0];
    return {
      total: Number(row?.total ?? 0),
      delivered: Number(row?.delivered ?? 0),
      opened: Number(row?.opened ?? 0),
      bounced: Number(row?.bounced ?? 0),
      openTrackingEnabled:
        row?.open_tracking_enabled === true ||
        row?.open_tracking_enabled === "true",
    };
  } catch {
    return {
      total: 0,
      delivered: 0,
      opened: 0,
      bounced: 0,
      openTrackingEnabled: false,
    };
  }
}

async function loadHourly(userId: string): Promise<HourBucket[]> {
  const empty = (): HourBucket[] =>
    Array.from({ length: 24 }, () => ({
      sent: 0,
      delivered: 0,
      opened: 0,
      bounced: 0,
    }));
  const since = new Date(Date.now() - 24 * HOUR_MS);
  try {
    const result = await db.execute(sql`
      SELECT
        date_trunc('hour', e.created_at) AS bucket,
        count(distinct e.id)::int AS sent,
        count(distinct e.id) FILTER (WHERE ev.type = 'delivered')::int AS delivered,
        count(distinct e.id) FILTER (WHERE ev.type = 'opened')::int AS opened,
        count(distinct e.id) FILTER (WHERE ev.type = 'bounced')::int AS bounced
      FROM ${emails} e
      LEFT JOIN ${emailEvents} ev ON ev.email_id = e.id
      WHERE e.user_id = ${userId} AND e.created_at >= ${since}
      GROUP BY bucket
      ORDER BY bucket ASC
    `);
    const rows = ((result as unknown as { rows?: unknown[] }).rows ??
      result) as unknown[];
    const byBucket = new Map<number, HourBucket>();
    for (const raw of rows as Array<{
      bucket: Date | string;
      sent: number | string;
      delivered: number | string;
      opened: number | string;
      bounced: number | string;
    }>) {
      const t = new Date(raw.bucket).getTime();
      byBucket.set(t, {
        sent: Number(raw.sent),
        delivered: Number(raw.delivered),
        opened: Number(raw.opened),
        bounced: Number(raw.bounced),
      });
    }
    const startHour =
      Math.floor((Date.now() - 23 * HOUR_MS) / HOUR_MS) * HOUR_MS;
    return Array.from({ length: 24 }, (_, i) => {
      const t = startHour + i * HOUR_MS;
      return (
        byBucket.get(t) ?? { sent: 0, delivered: 0, opened: 0, bounced: 0 }
      );
    });
  } catch {
    return empty();
  }
}

type Activity = {
  id: string;
  type: string;
  recipient: string | null;
  at: Date;
};

async function loadActivity(userId: string): Promise<Activity[]> {
  try {
    const rows = await db
      .select({
        id: emailEvents.id,
        type: emailEvents.type,
        receivedAt: emailEvents.receivedAt,
        recipient: sql<string | null>`(${emails.to}->>0)`,
      })
      .from(emailEvents)
      .leftJoin(emails, eq(emails.id, emailEvents.emailId))
      .where(eq(emailEvents.userId, userId))
      .orderBy(desc(emailEvents.receivedAt))
      .limit(5);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      recipient: r.recipient,
      at: r.receivedAt,
    }));
  } catch {
    return [];
  }
}

type DomainRow = {
  id: string;
  name: string;
  status: string;
  region: string;
  configurationSetName: string | null;
  total: number;
  delivered: number;
  opened: number;
  providerFeedbackWired: boolean;
  providerFeedbackUnknown: boolean;
  openTrackingEnabled: boolean;
};

type DomainReputationRow = Omit<
  DomainRow,
  "providerFeedbackWired" | "providerFeedbackUnknown"
>;
type RecentSenderDomainsResult = {
  candidates: ProviderFeedbackCandidate[];
  truncated: boolean;
  loadFailed: boolean;
};

async function loadRecentSenderDomains(
  userId: string,
): Promise<RecentSenderDomainsResult> {
  const since = new Date(Date.now() - 24 * HOUR_MS);
  try {
    const result = await db.execute(sql`
      SELECT
        d.id::text AS id,
        d.name AS name,
        d.region AS region,
        d.ses_configuration_set_name AS "configurationSetName",
        max(e.created_at) AS "lastSentAt"
      FROM ${domains} d
      JOIN ${emails} e
        ON e.user_id = d.user_id
       AND e.created_at >= ${since}
       AND (
         lower(e.from) LIKE '%@' || lower(d.name)
         OR lower(e.from) LIKE '%@' || lower(d.name) || '>'
       )
      WHERE d.user_id = ${userId}
      GROUP BY d.id, d.name, d.region, d.ses_configuration_set_name
      ORDER BY max(e.created_at) DESC
      LIMIT ${RECENT_SENDER_DOMAIN_LIMIT + 1}
    `);
    const rawRows = (result as unknown as { rows?: unknown[] }).rows;
    const rows: unknown[] = rawRows ?? (result as unknown as unknown[]);
    const boundedRows = (rows as ProviderFeedbackCandidate[]).slice(
      0,
      RECENT_SENDER_DOMAIN_LIMIT,
    );
    return {
      candidates: boundedRows.map((row) => ({
        id: row.id,
        name: row.name,
        region: row.region,
        configurationSetName: row.configurationSetName ?? null,
      })),
      truncated: rows.length > RECENT_SENDER_DOMAIN_LIMIT,
      loadFailed: false,
    };
  } catch {
    return { candidates: [], truncated: false, loadFailed: true };
  }
}

async function loadDomainReputation(
  userId: string,
): Promise<DomainReputationRow[]> {
  const since = new Date(Date.now() - 24 * HOUR_MS);
  try {
    const result = await db.execute(sql`
      SELECT
        d.id::text AS id,
        d.name AS name,
        d.status AS status,
        d.region AS region,
        d.ses_configuration_set_name AS "configurationSetName",
        d.track_opens = true AS "openTrackingEnabled",
        count(distinct e.id)::int AS total,
        count(distinct e.id) FILTER (WHERE ev.type = 'delivered')::int AS delivered,
        count(distinct e.id) FILTER (WHERE ev.type = 'opened')::int AS opened
      FROM ${domains} d
      LEFT JOIN ${emails} e
        ON e.user_id = d.user_id
       AND e.created_at >= ${since}
       AND (
         lower(e.from) LIKE '%@' || lower(d.name)
         OR lower(e.from) LIKE '%@' || lower(d.name) || '>'
       )
      LEFT JOIN ${emailEvents} ev ON ev.email_id = e.id
      WHERE d.user_id = ${userId}
      GROUP BY d.id, d.name, d.status, d.region, d.ses_configuration_set_name, d.track_opens, d.created_at
      ORDER BY d.created_at DESC
      LIMIT 6
    `);
    const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
    return (rows as DomainReputationRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      region: r.region,
      configurationSetName: r.configurationSetName ?? null,
      total: Number(r.total),
      delivered: Number(r.delivered),
      opened: Number(r.opened),
      openTrackingEnabled:
        r.openTrackingEnabled === true ||
        String(r.openTrackingEnabled) === "true",
    }));
  } catch {
    return [];
  }
}

function formatPct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${((num / denom) * 100).toFixed(1)}`;
}

function greeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 5) return `Working late, ${name}.`;
  if (hour < 12) return `Good morning, ${name}.`;
  if (hour < 18) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

function describeStatus(stats: {
  total: number;
  delivered: number;
  bounced: number;
}): string {
  if (stats.total === 0) {
    return "No sends in the last 24 hours. Verify a domain and create an API key to start sending.";
  }
  const bounceRate = (stats.bounced / stats.total) * 100;
  const deliveredRate = (stats.delivered / stats.total) * 100;
  if (bounceRate > 5) {
    return `Bounce rate at ${bounceRate.toFixed(1)}% over the last 24h — review your suppression list and recent recipients.`;
  }
  if (deliveredRate < 90 && stats.total >= 10) {
    return `Delivery at ${deliveredRate.toFixed(1)}% — some recent sends are still pending or deferred.`;
  }
  return `${stats.total.toLocaleString()} sends in the last 24h. Delivery latency and bounce rate within target.`;
}

function classifyDomainStatus(raw: string): StatusKind {
  const s = raw.toLowerCase();
  if (s === "verified" || s === "active") return "verified";
  if (s === "failed" || s === "suspended" || s === "warning") return "warning";
  return "pending";
}

function normalizeEventType(type: string): {
  label: string;
  bounced: boolean;
} {
  const last = type.split(".").pop()?.toLowerCase() ?? type.toLowerCase();
  return { label: last, bounced: last === "bounced" || last === "complained" };
}

function relativeTime(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export default async function TodayPage() {
  const session = await getServerSession();
  if (!session) redirect("/auth");

  const userId = session.user.id;
  const [stats, hourly, activity, rawDomainRows, recentSenderDomainsResult] =
    await Promise.all([
      loadStats(userId),
      loadHourly(userId),
      loadActivity(userId),
      loadDomainReputation(userId),
      loadRecentSenderDomains(userId),
    ]);
  const recentSenderDomains = recentSenderDomainsResult.candidates;
  const providerFeedbackReadErrorIds = new Set<string>();
  const providerFeedbackWiring = await resolveProviderFeedbackWiring(
    [
      ...rawDomainRows.map((row) => ({
        id: row.id,
        name: row.name,
        region: row.region,
        configurationSetName: row.configurationSetName,
      })),
      ...recentSenderDomains,
    ],
    {
      onReadError: (candidate, error) => {
        providerFeedbackReadErrorIds.add(candidate.id);
        console.warn(
          `Failed to read SES event destination for ${candidate.name}:`,
          error,
        );
      },
    },
  );
  const domainRows: DomainRow[] = rawDomainRows.map((row) => ({
    ...row,
    providerFeedbackWired: providerFeedbackWiring.get(row.id) ?? false,
    providerFeedbackUnknown: providerFeedbackReadErrorIds.has(row.id),
  }));
  const providerFeedbackUnknown =
    recentSenderDomainsResult.truncated ||
    recentSenderDomainsResult.loadFailed ||
    providerFeedbackReadErrorIds.size > 0;
  const providerFeedbackWired =
    !providerFeedbackUnknown &&
    areAllRecentSenderDomainsWired(recentSenderDomains, providerFeedbackWiring);
  const firstName =
    (session.user.name || session.user.email || "there").split(/[\s@]/)[0] ||
    "there";

  const kickerDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const sentSpark = hourly.map((h) => h.sent);
  const deliveredSpark = hourly.map((h) => h.delivered);
  const openedSpark = hourly.map((h) => h.opened);
  const bouncedSpark = hourly.map((h) => h.bounced);
  const chartSummary = getTodayChartSummary({
    total: stats.total,
    hourly,
  });
  const chartMax = chartSummary.peak;
  const chartInsetTop = 8;
  const chartInsetBottom = 14;
  const chartHeight = 100;
  const chartUsableHeight = chartHeight - chartInsetTop - chartInsetBottom;
  const toChartPoints = (values: number[]) =>
    values.map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
      const y =
        chartInsetTop +
        chartUsableHeight -
        (Math.max(0, value) / chartMax) * chartUsableHeight;
      return { x, y };
    });
  const toLinePath = (points: Array<{ x: number; y: number }>) =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(
            2,
          )}`,
      )
      .join(" ");
  const sentPoints = toChartPoints(sentSpark);
  const openedPoints = toChartPoints(openedSpark);
  const bouncedPoints = toChartPoints(bouncedSpark);
  const sentLinePath = toLinePath(sentPoints);
  const openedLinePath = toLinePath(openedPoints);
  const bouncedLinePath = toLinePath(bouncedPoints);
  const sentAreaPath = sentPoints.length
    ? `M ${sentPoints[0]?.x.toFixed(2)} ${chartHeight} L ${sentLinePath.slice(
        2,
      )} L ${sentPoints.at(-1)?.x.toFixed(2)} ${chartHeight} Z`
    : "";
  const deliveryState = getProviderFeedbackMetricState({
    total: stats.total,
    providerFeedbackWired,
    providerFeedbackUnknown,
  });
  const openState = getOpenTrackingMetricState({
    total: stats.total,
    openTrackingEnabled: stats.openTrackingEnabled,
  });
  const deliveryStateLabel = dashboardMetricStateLabel(deliveryState);
  const openStateLabel = dashboardMetricStateLabel(openState);

  const requestHeaders = await headers();
  const apiBase = getTodayApiBaseUrl(requestHeaders);
  const apiSendUrl = `${apiBase}/emails`;
  const fromExample = domainRows[0]?.name
    ? `hi@${domainRows[0].name}`
    : "hi@your-verified-domain.com";

  return (
    <div className="pb-16">
      <div className="px-8 pt-8">
        <PageHeader
          kicker={`// today · ${kickerDate}`}
          title={greeting(firstName)}
          sub={describeStatus(stats)}
          action={
            <>
              <Link href="/docs" className="btn btn-ghost">
                Open docs
              </Link>
              <Link href="/api-keys" className="btn btn-primary">
                New API key
              </Link>
            </>
          }
        />
      </div>

      <div className="flex flex-col gap-5 px-8 pt-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            kicker="Sent · 24h"
            value={stats.total.toLocaleString()}
            spark={sentSpark}
          />
          <StatCard
            kicker="Delivered"
            value={
              deliveryStateLabel ? (
                <span className="text-[18px] text-fg-3">
                  {deliveryStateLabel}
                </span>
              ) : (
                <>
                  {formatPct(stats.delivered, stats.total)}
                  <span className="text-[24px] text-fg-3">%</span>
                </>
              )
            }
            spark={deliveredSpark}
          />
          <StatCard
            kicker="Opens"
            value={
              openStateLabel ? (
                <span className="text-[18px] text-fg-3">{openStateLabel}</span>
              ) : (
                <>
                  {formatPct(stats.opened, stats.total)}
                  <span className="text-[24px] text-fg-3">%</span>
                </>
              )
            }
            spark={openedSpark}
          />
          <StatCard
            kicker="Bounces"
            value={
              <>
                {formatPct(stats.bounced, stats.total)}
                <span className="text-[24px] text-fg-3">%</span>
              </>
            }
            spark={bouncedSpark}
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionHeader
              kicker="// send volume · last 24h"
              title="Hourly sends"
              sub="Accepted sends grouped by hour, with opens and bounces overlaid when tracking or provider feedback exists."
              action={
                <div className="mono flex gap-3.5 text-[11.5px] text-fg-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-2 bg-accent" />
                    sent
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-2 bg-violet" />
                    opened
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-2 bg-red/70" />
                    bounced
                  </span>
                </div>
              }
            />
            <div className="mono mt-3 flex items-center justify-between text-[11px] text-fg-4">
              <span>00:00</span>
              <span>
                {chartSummary.label}
                /hr
              </span>
              <span>24:00</span>
            </div>
            <div className="relative mt-2 h-[220px] overflow-hidden">
              <svg
                aria-label="Hourly sends chart"
                className="absolute inset-0 h-full w-full"
                preserveAspectRatio="none"
                role="img"
                viewBox="0 0 100 100"
              >
                <defs>
                  <linearGradient
                    id="today-sent-area"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--accent)"
                      stopOpacity="0.26"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--accent)"
                      stopOpacity="0.03"
                    />
                  </linearGradient>
                </defs>
                {[22, 40, 58, 76].map((y) => (
                  <line
                    key={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="1.5 2.5"
                    strokeWidth="0.25"
                    vectorEffect="non-scaling-stroke"
                    x1="0"
                    x2="100"
                    y1={y}
                    y2={y}
                  />
                ))}
                {sentAreaPath && (
                  <path d={sentAreaPath} fill="url(#today-sent-area)" />
                )}
                <path
                  d={sentLinePath}
                  fill="none"
                  stroke="var(--accent)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={openedLinePath}
                  fill="none"
                  stroke="var(--violet)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="0.65"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={bouncedLinePath}
                  fill="none"
                  stroke="var(--red)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.72"
                  strokeWidth="0.55"
                  vectorEffect="non-scaling-stroke"
                />
                {sentPoints.map((point, index) => (
                  <circle
                    // biome-ignore lint/suspicious/noArrayIndexKey: hour buckets are stable ordinals
                    key={index}
                    className="opacity-0 transition-opacity hover:opacity-100"
                    cx={point.x}
                    cy={point.y}
                    fill="var(--accent)"
                    r="1.2"
                  >
                    <title>
                      {`${hourly[index]?.sent ?? 0} sent · ${
                        hourly[index]?.opened ?? 0
                      } opened · ${hourly[index]?.bounced ?? 0} bounced`}
                    </title>
                  </circle>
                ))}
              </svg>
              <div className="mono pointer-events-none absolute inset-x-0 bottom-0 flex justify-between border-t border-line/70 pt-2 text-[11px] text-fg-4">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>
            {stats.total === 0 && (
              <div className="mono mt-3 text-[11.5px] text-fg-4">
                No sends yet — the chart will fill in as activity comes through.
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader
              kicker="// realtime"
              title="Live activity"
              action={
                <Pill variant="success">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    style={{ boxShadow: "0 0 8px var(--accent)" }}
                  />
                  live
                </Pill>
              }
            />
            {activity.length === 0 ? (
              <div className="mt-3 text-[12.5px] text-fg-3">
                No recent events. Send your first email to see live deliveries
                here.
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-2.5 text-[12.5px]">
                {activity.map((a) => {
                  const { label, bounced } = normalizeEventType(a.type);
                  return (
                    <li key={a.id} className="flex items-center gap-2.5">
                      <span
                        className={`h-1.5 w-1.5 flex-none rounded-full ${
                          bounced ? "bg-red" : "bg-accent"
                        }`}
                      />
                      <span className="mono text-[11px] uppercase tracking-[0.12em] text-fg-3">
                        {label}
                      </span>
                      <span className="flex-1 truncate text-fg-2">
                        {a.recipient ?? "—"}
                      </span>
                      <span className="mono text-[11px] text-fg-4">
                        {relativeTime(a.at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Card>
            <SectionHeader
              kicker="// deliverability"
              title="Reputation by domain"
              sub="Last-24h provider feedback from accepted sends and SES/SNS lifecycle events."
              action={
                <Link
                  href="/domains"
                  className="mono text-[11.5px] text-fg-3 hover:text-fg-2"
                >
                  view all →
                </Link>
              }
            />
            {domainRows.length === 0 ? (
              <div className="mt-3 text-[12.5px] text-fg-3">
                No domains yet.{" "}
                <Link href="/domains" className="text-fg hover:underline">
                  Add a domain →
                </Link>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-3.5">
                {domainRows.map((d) => {
                  const kind = classifyDomainStatus(d.status);
                  const deliveredPct =
                    d.total > 0 ? (d.delivered / d.total) * 100 : null;
                  const openedPct =
                    d.total > 0 ? (d.opened / d.total) * 100 : null;
                  const rowDeliveryLabel = dashboardMetricStateLabel(
                    getProviderFeedbackMetricState({
                      total: d.total,
                      providerFeedbackWired: d.providerFeedbackWired,
                      providerFeedbackUnknown: d.providerFeedbackUnknown,
                    }),
                  );
                  const rowOpenLabel = dashboardMetricStateLabel(
                    getOpenTrackingMetricState({
                      total: d.total,
                      openTrackingEnabled: d.openTrackingEnabled,
                    }),
                  );
                  return (
                    <div
                      key={d.id}
                      className="grid grid-cols-[1.4fr_auto_1fr_1fr] items-center gap-4"
                    >
                      <span className="mono text-[13.5px] text-fg">
                        {d.name}
                      </span>
                      <Pill
                        variant={
                          kind === "verified"
                            ? "success"
                            : kind === "warning"
                              ? "error"
                              : "warn"
                        }
                      >
                        {d.status}
                      </Pill>
                      <Meter
                        label="delivered"
                        value={deliveredPct}
                        stateLabel={rowDeliveryLabel}
                        color="var(--accent)"
                        max={100}
                      />
                      <Meter
                        label="opens"
                        value={openedPct}
                        stateLabel={rowOpenLabel}
                        color="var(--violet)"
                        max={100}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader kicker="// quick start" title="Send a test in 30s" />
            <pre className="mono mt-3 overflow-hidden rounded-lg border border-line bg-black/30 px-4 py-3.5 text-[12.5px] leading-[1.7] text-fg-2">
              <span className="text-violet">curl</span> -X POST {apiSendUrl} \
              {"\n"}
              {"  "}-H{" "}
              <span className="text-accent">
                "Authorization: Bearer os_live_•••"
              </span>{" "}
              \{"\n"}
              {"  "}-d{" "}
              <span className="text-accent">
                {`'{"from":"${fromExample}","to":"jane@example.com","subject":"hi","html":"<b>hi</b>"}'`}
              </span>
            </pre>
            <div className="mt-3 flex items-center gap-2">
              <Link href="/docs/quickstart" className="btn btn-ghost btn-sm">
                Open docs
              </Link>
              <span className="flex-1" />
              <span className="mono text-[11.5px] text-fg-3">POST /emails</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meter({
  label,
  value,
  stateLabel,
  max,
  color,
}: {
  label: string;
  value: number | null;
  stateLabel?: string | null;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="mono mb-1 text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
        {label}
      </div>
      {stateLabel ? (
        <span className="text-[12px] text-fg-4">{stateLabel}</span>
      ) : value === null ? (
        <span className="text-[12px] text-fg-4">—</span>
      ) : (
        <div className="flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, (value / max) * 100)}%`,
                background: color,
              }}
            />
          </div>
          <span className="mono w-10 text-right text-[11.5px] text-fg">
            {value.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
