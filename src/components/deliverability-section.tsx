// ABOUTME: Deliverability Rate section — event type filter dropdown, SVG line/area chart, per-domain breakdown table

"use client";

import {
  DropdownFilter,
  type DropdownFilterOption,
} from "@/components/dropdown-filter";

// ── Exports for testing ────────────────────────────────────────────

export function calculateDeliverabilityRate(
  delivered: number,
  sent: number,
): number {
  if (sent === 0) return 0;
  return Math.round((delivered / sent) * 10000) / 100;
}

export const EVENT_TYPE_OPTIONS: DropdownFilterOption[] = [
  { value: "all", label: "All Events" },
  { value: "received", label: "Received", color: "#3B82F6" },
  { value: "delivered", label: "Delivered", color: "#22C55E" },
  { value: "opened", label: "Opened", color: "#8B5CF6" },
  { value: "clicked", label: "Clicked", color: "#06B6D4" },
  { value: "bounced", label: "Bounced", color: "#EF4444" },
  { value: "complained", label: "Complained", color: "#F59E0B" },
  { value: "unsubscribed", label: "Unsubscribed", color: "#6B7280" },
  { value: "delivery_delayed", label: "Delivery Delayed", color: "#F97316" },
  { value: "failed", label: "Failed", color: "#DC2626" },
  { value: "suppressed", label: "Suppressed", color: "#9CA3AF" },
];

// ── Types ──────────────────────────────────────────────────────────

interface DailyDataPoint {
  date: string;
  count: number;
}

interface DomainBreakdownEntry {
  domain: string;
  rate: number;
  count: number;
}

interface DeliverabilityData {
  totalEmails: number;
  deliverabilityRate: number;
  dailyData: DailyDataPoint[];
  domainBreakdown: DomainBreakdownEntry[];
}

interface DeliverabilitySectionProps {
  data: DeliverabilityData;
  loading: boolean;
  eventType: string;
  onEventTypeChange: (value: string) => void;
}

// ── Date formatting ────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month}, ${day}`;
}

// ── SVG Chart ──────────────────────────────────────────────────────

function DeliverabilityChart({ data }: { data: DailyDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-fg-2 text-[13px]">
        No data for this period
      </div>
    );
  }

  const chartWidth = 700;
  const chartHeight = 200;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  // Round up to a nice number for y-axis
  const yMax = maxCount <= 4 ? maxCount : Math.ceil(maxCount * 1.2);
  const yTicks = generateYTicks(yMax);

  // Scale functions
  const xScale = (i: number) =>
    paddingLeft + (i / Math.max(data.length - 1, 1)) * plotWidth;
  const yScale = (v: number) =>
    paddingTop + plotHeight - (v / yMax) * plotHeight;

  // Build line path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.count)}`)
    .join(" ");

  // Build area path (filled under the line)
  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`;

  return (
    <svg
      role="application"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22C55E" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22C55E" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y-axis grid lines and labels */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={paddingLeft}
            y1={yScale(tick)}
            x2={chartWidth - paddingRight}
            y2={yScale(tick)}
            stroke="rgba(176,199,217,0.1)"
            strokeWidth="1"
          />
          <text
            x={chartWidth - paddingRight + 5}
            y={yScale(tick) + 4}
            fill="#A1A4A5"
            fontSize="10"
            textAnchor="start"
          >
            {tick}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGradient)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="#22C55E"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={d.date}
          cx={xScale(i)}
          cy={yScale(d.count)}
          r="3"
          fill="#22C55E"
          className="opacity-0 hover:opacity-100 transition-opacity"
        />
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => {
        // Show every Nth label to avoid overlap
        const labelEvery = data.length > 15 ? 3 : data.length > 7 ? 2 : 1;
        if (i % labelEvery !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={d.date}
            x={xScale(i)}
            y={chartHeight - 5}
            fill="#A1A4A5"
            fontSize="10"
            textAnchor="middle"
          >
            {formatDateLabel(d.date)}
          </text>
        );
      })}
    </svg>
  );
}

function generateYTicks(yMax: number): number[] {
  if (yMax <= 0) return [0];
  const ticks: number[] = [];
  const step = yMax <= 4 ? 1 : yMax <= 10 ? 2 : Math.ceil(yMax / 4);
  for (let i = 0; i <= yMax; i += step) {
    ticks.push(i);
  }
  if (ticks[ticks.length - 1] !== yMax) {
    ticks.push(yMax);
  }
  return ticks;
}

// ── Domain breakdown table ─────────────────────────────────────────

function DomainBreakdownTable({
  breakdown,
}: { breakdown: DomainBreakdownEntry[] }) {
  if (breakdown.length === 0) return null;

  return (
    <div className="mt-4 border-t border-line pt-4">
      {breakdown.map((entry) => (
        <div
          key={entry.domain}
          className="flex items-center justify-between py-2"
        >
          <span className="text-[13px] text-fg">
            {entry.domain} <span className="text-fg-2">({entry.count})</span>
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-fg">
            {entry.rate === 100 && (
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22C55E"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {entry.rate}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── DeliverabilitySection ──────────────────────────────────────────

export function DeliverabilitySection({
  data,
  loading,
  eventType,
  onEventTypeChange,
}: DeliverabilitySectionProps) {
  return (
    <div>
      {/* Summary row + event filter */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-fg-2 uppercase">
              Emails
            </div>
            <div className="text-2xl font-semibold text-fg">
              {loading ? "—" : data.totalEmails}
            </div>
          </div>
        </div>
        <DropdownFilter
          options={EVENT_TYPE_OPTIONS}
          value={eventType}
          onChange={onEventTypeChange}
        />
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-fg-2 text-[13px]">
          Loading...
        </div>
      ) : (
        <DeliverabilityChart data={data.dailyData} />
      )}

      {/* Domain breakdown */}
      {!loading && <DomainBreakdownTable breakdown={data.domainBreakdown} />}
    </div>
  );
}
