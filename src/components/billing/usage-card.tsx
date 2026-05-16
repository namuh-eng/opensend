"use client";

import {
  type UsageMetric,
  formatUsagePercent,
  getProgressBarPercent,
  getUsageThreshold,
} from "@/lib/billing/usage";

type KnownUsageMetric = UsageMetric;
type MaybeKnownUsageMetric = { used: number | null; limit: number };

function thresholdColor(threshold: ReturnType<typeof getUsageThreshold>) {
  if (threshold === "critical") return "bg-red-500";
  if (threshold === "warn") return "bg-amber-500";
  return "bg-blue-500";
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

interface UsageRowProps {
  label: string;
  metric: KnownUsageMetric;
  testId?: string;
}

function UsageRow({ label, metric, testId }: UsageRowProps) {
  const threshold = getUsageThreshold(metric);
  const percent = getProgressBarPercent(metric);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-fg-2">{label}</span>
        <span className="font-medium text-fg">
          {formatNumber(metric.used)} / {formatNumber(metric.limit)}
          <span
            className="ml-2 text-[12px] text-fg-2"
            data-testid={testId ? `${testId}-percent` : undefined}
          >
            {formatUsagePercent(metric)}
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.14]">
        <div
          className={`h-full ${thresholdColor(threshold)} transition-all`}
          style={{ width: `${percent}%` }}
          data-threshold={threshold}
        />
      </div>
    </div>
  );
}

interface UnknownUsageRowProps {
  label: string;
  limit: number;
  testId: string;
}

function UnknownUsageRow({ label, limit, testId }: UnknownUsageRowProps) {
  return (
    <div
      className="rounded-md border border-dashed border-line p-3"
      data-testid={testId}
    >
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-fg-2">{label}</span>
        <span className="font-medium text-fg">
          Unknown / {formatNumber(limit)}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-fg-2">
        Usage has not been reported for this billing period yet.
      </p>
    </div>
  );
}

export interface UsageCardData {
  emails: MaybeKnownUsageMetric;
  domains: UsageMetric;
  apiKeys: UsageMetric;
  periodStart: string | null;
  periodEnd: string | null;
  hasUsagePeriod: boolean;
}

function formatRange(start: string | null, end: string | null) {
  if (!start || !end) return "Current period";
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  try {
    return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
  } catch {
    return "Current period";
  }
}

export function UsageCard({ data }: { data: UsageCardData }) {
  const emailUsed = data.emails.used;
  const emailUsageKnown = data.hasUsagePeriod && emailUsed !== null;

  return (
    <div
      className="rounded-lg border border-line bg-bg-3 p-6"
      data-testid="billing-usage-card"
    >
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-[16px] font-semibold text-fg">Usage</h2>
        <span className="text-[12px] text-fg-2">
          {formatRange(data.periodStart, data.periodEnd)}
        </span>
      </div>
      <div className="space-y-5">
        {emailUsageKnown ? (
          <UsageRow
            label="Emails sent"
            metric={{ used: emailUsed, limit: data.emails.limit }}
            testId="usage-emails"
          />
        ) : (
          <UnknownUsageRow
            label="Emails sent"
            limit={data.emails.limit}
            testId="usage-emails-unknown"
          />
        )}
        <UsageRow
          label="Domains"
          metric={data.domains}
          testId="usage-domains"
        />
        <UsageRow
          label="API keys"
          metric={data.apiKeys}
          testId="usage-api-keys"
        />
      </div>
    </div>
  );
}
