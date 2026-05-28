// ABOUTME: Metrics page layout — domain filter, date range picker, 3 collapsible metric sections (Deliverability, Bounce, Complain)

"use client";

import { BounceRateSection } from "@/components/bounce-rate-section";
import {
  ComboboxFilter,
  type ComboboxOption,
} from "@/components/combobox-filter";
import { ComplainRateSection } from "@/components/complain-rate-section";
import { DateRangePicker } from "@/components/date-range-picker";
import { DeliverabilitySection } from "@/components/deliverability-section";
import { Card } from "@/components/ui-new";
import { useCallback, useEffect, useState } from "react";

// ── Date range preset → API param mapping ───────────────────────────

const DATE_RANGE_TO_API: Record<string, string> = {
  Today: "today",
  Yesterday: "yesterday",
  "Last 3 days": "last_3_days",
  "Last 7 days": "last_7_days",
  "Last 15 days": "last_15_days",
  "Last 30 days": "last_30_days",
};

const TAG_NAME_PREFIX = "name:";
const TAG_VALUE_PREFIX = "value:";

// ── Types ───────────────────────────────────────────────────────────

interface DailyDataPoint {
  date: string;
  count: number;
}

interface DomainBreakdownEntry {
  domain: string;
  rate: number;
  count: number;
}

interface BounceBreakdown {
  permanent: number;
  transient: number;
  undetermined: number;
}

interface DailyBouncePoint {
  date: string;
  rate: number;
}

interface DailyComplainPoint {
  date: string;
  rate: number;
}

interface TagOption {
  name: string;
  values: string[];
}

interface TagBreakdownEntry {
  name: string;
  value: string;
  count: number;
  rate: number;
}

interface MetricsData {
  totalEmails: number;
  deliverabilityRate: number;
  bounceRate: number;
  complainRate: number;
  complained: number;
  domains: string[];
  tagOptions: TagOption[];
  tagBreakdown: TagBreakdownEntry[];
  dailyData: DailyDataPoint[];
  domainBreakdown: DomainBreakdownEntry[];
  bounceBreakdown: BounceBreakdown;
  dailyBounceData: DailyBouncePoint[];
  dailyComplainData: DailyComplainPoint[];
  lastUpdated: string;
}

function tagNameFilterValue(name: string): string {
  return `${TAG_NAME_PREFIX}${name}`;
}

function tagValueFilterValue(name: string, value: string): string {
  return `${TAG_VALUE_PREFIX}${name}:${value}`;
}

function getTagLabel(name: string, value: string): string {
  return `${name}: ${value === "" ? "(empty)" : value}`;
}

function appendTagParams(params: URLSearchParams, tagFilter: string): void {
  if (tagFilter.startsWith(TAG_VALUE_PREFIX)) {
    const raw = tagFilter.slice(TAG_VALUE_PREFIX.length);
    const separatorIndex = raw.indexOf(":");
    if (separatorIndex <= 0) return;
    params.set("tag_name", raw.slice(0, separatorIndex));
    params.set("tag_value", raw.slice(separatorIndex + 1));
    return;
  }

  if (tagFilter.startsWith(TAG_NAME_PREFIX)) {
    const name = tagFilter.slice(TAG_NAME_PREFIX.length);
    if (name) params.set("tag_name", name);
  }
}

// ── MetricSection (collapsible) ─────────────────────────────────────

interface MetricSectionProps {
  title: string;
  value: string;
  defaultOpen?: boolean;
  infoButton?: boolean;
  children?: React.ReactNode;
}

export function MetricSection({
  title,
  value,
  defaultOpen = true,
  infoButton = false,
  children,
}: MetricSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card padding="none">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-6">
          <span className="kicker">{title}</span>
          <span className="serif text-[36px] leading-none tracking-tight text-fg">
            {value}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {infoButton && (
            <span className="text-fg-3 hover:text-fg transition-colors">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </span>
          )}
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-fg-3 transition-transform ${open ? "" : "-rotate-90"}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>
      {open && children && (
        <div className="border-t border-line px-5 pb-5 pt-4">{children}</div>
      )}
    </Card>
  );
}

// ── MetricsPage ─────────────────────────────────────────────────────

export function MetricsPage() {
  const [dateRange, setDateRange] = useState("Last 15 days");
  const [domain, setDomain] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("range", DATE_RANGE_TO_API[dateRange] || "last_15_days");
    if (domain !== "all") {
      params.set("domain", domain);
    }
    if (eventType !== "all") {
      params.set("event_type", eventType);
    }
    if (tagFilter !== "all") {
      appendTagParams(params, tagFilter);
    }
    try {
      const res = await fetch(`/api/metrics?${params.toString()}`);
      if (res.ok) {
        const json: MetricsData = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, domain, eventType, tagFilter]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Build domain filter options
  const domainOptions: ComboboxOption[] = [
    { value: "all", label: "All Domains" },
    ...(data?.domains ?? []).map((d) => ({
      value: d,
      label: d,
    })),
  ];

  const tagOptions: ComboboxOption[] = [
    { value: "all", label: "All Tags" },
    ...(data?.tagOptions ?? []).flatMap((tag) => [
      { value: tagNameFilterValue(tag.name), label: `${tag.name}: Any value` },
      ...tag.values.map((value) => ({
        value: tagValueFilterValue(tag.name, value),
        label: getTagLabel(tag.name, value),
      })),
    ]),
  ];

  const lastUpdatedStr = data?.lastUpdated
    ? new Date(data.lastUpdated).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-fg">Metrics</h1>
        <div className="flex items-center gap-2">
          <ComboboxFilter
            options={domainOptions}
            value={domain}
            onChange={setDomain}
          />
          <ComboboxFilter
            options={tagOptions}
            value={tagFilter}
            onChange={setTagFilter}
          />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Deliverability Rate section */}
      <div className="space-y-4">
        {(data?.tagBreakdown?.length ?? 0) > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <span className="kicker">TAG BREAKDOWN</span>
              <span className="text-[12px] text-fg-3">Top 50 by volume</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.tagBreakdown ?? []).map((tag) => (
                <div
                  key={`${tag.name}:${tag.value}`}
                  className="rounded-lg border border-line bg-bg-2 px-3 py-2"
                  data-testid="tag-breakdown-row"
                >
                  <div className="font-mono text-[12px] text-fg">
                    <span className="text-fg-2">{tag.name}:</span>{" "}
                    {tag.value === "" ? "(empty)" : tag.value}
                  </div>
                  <div className="mt-1 text-[12px] text-fg-3">
                    {tag.count} emails · {tag.rate}% delivered
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <MetricSection
          title="DELIVERABILITY RATE"
          value={loading ? "—" : `${data?.deliverabilityRate ?? 0}%`}
          defaultOpen={true}
        >
          <DeliverabilitySection
            data={{
              totalEmails: data?.totalEmails ?? 0,
              deliverabilityRate: data?.deliverabilityRate ?? 0,
              dailyData: data?.dailyData ?? [],
              domainBreakdown: data?.domainBreakdown ?? [],
            }}
            loading={loading}
            eventType={eventType}
            onEventTypeChange={setEventType}
          />
        </MetricSection>

        {/* Bounce Rate section */}
        <MetricSection
          title="BOUNCE RATE"
          value={loading ? "—" : `${data?.bounceRate ?? 0}%`}
          defaultOpen={true}
          infoButton={false}
        >
          <BounceRateSection
            data={{
              bounceRate: data?.bounceRate ?? 0,
              permanent: data?.bounceBreakdown?.permanent ?? 0,
              transient: data?.bounceBreakdown?.transient ?? 0,
              undetermined: data?.bounceBreakdown?.undetermined ?? 0,
              sent: data?.totalEmails ?? 0,
              dailyBounceData: data?.dailyBounceData ?? [],
            }}
            loading={loading}
            dateRange={dateRange}
          />
        </MetricSection>

        {/* Complain Rate section */}
        <MetricSection
          title="COMPLAIN RATE"
          value={loading ? "—" : `${data?.complainRate ?? 0}%`}
          defaultOpen={true}
          infoButton={false}
        >
          <ComplainRateSection
            data={{
              complainRate: data?.complainRate ?? 0,
              complaints: data?.complained ?? 0,
              sent: data?.totalEmails ?? 0,
              dailyComplainData: data?.dailyComplainData ?? [],
            }}
            loading={loading}
            dateRange={dateRange}
          />
        </MetricSection>
      </div>

      {/* Footer */}
      <div className="mt-4 text-[12px] text-fg-2">
        Data is updated every 15 minutes. Last updated {lastUpdatedStr}.
      </div>
    </div>
  );
}
