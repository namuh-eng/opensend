// ABOUTME: Bounce Rate section — info panel (How Bounce Rate Works), SVG chart (0-8% Y-axis), breakdown table (Transient/Permanent/Undetermined)

"use client";

import { useEffect, useState } from "react";

// ── Exports for testing ────────────────────────────────────────────

export function calculateBounceRate(input: {
  permanent: number;
  transient: number;
  undetermined: number;
  sent: number;
}): number {
  if (input.sent === 0) return 0;
  const total = input.permanent + input.transient + input.undetermined;
  return Math.round((total / input.sent) * 10000) / 100;
}

// ── Types ──────────────────────────────────────────────────────────

interface DailyBouncePoint {
  date: string;
  rate: number;
}

interface BounceRateData {
  bounceRate: number;
  permanent: number;
  transient: number;
  undetermined: number;
  sent: number;
  dailyBounceData: DailyBouncePoint[];
}

interface BounceRateSectionProps {
  data: BounceRateData;
  loading: boolean;
  dateRange: string;
}

// ── Date helpers ──────────────────────────────────────────────────

const DATE_RANGE_DAYS: Record<string, number> = {
  Today: 0,
  Yesterday: 1,
  "Last 3 days": 3,
  "Last 7 days": 7,
  "Last 15 days": 15,
  "Last 30 days": 30,
};

function getDateRangeParams(dateRange: string): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  const days = DATE_RANGE_DAYS[dateRange] ?? 15;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().split("T")[0];
  return { startDate, endDate };
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month}, ${day}`;
}

// ── Info Panel ────────────────────────────────────────────────────

function BounceInfoPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        role="presentation"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      />
      {/* Panel */}
      <div className="relative w-full max-w-md bg-bg-3 border-l border-line p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-fg">
            How Bounce Rate Works
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-fg-2 hover:text-fg transition-colors"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="text-[13px] text-fg-2 mb-6">
          A bounce happens when an email cannot be delivered, and is returned to
          the sender.
        </p>

        <h3 className="text-[14px] font-semibold text-fg mb-3">
          What are the types of bounces?
        </h3>
        <ul className="space-y-2 mb-6 text-[13px] text-fg-2">
          <li>
            <span className="text-fg font-medium">
              Permanent (hard bounce):
            </span>{" "}
            The recipient&apos;s mail server rejects the email and will never be
            delivered.
          </li>
          <li>
            <span className="text-fg font-medium">
              Transient (soft bounce):
            </span>{" "}
            The email was temporarily rejected due to a temporary issue (e.g.,
            full inbox, invalid email address).
          </li>
          <li>
            <span className="text-fg font-medium">Undetermined (bounce):</span>{" "}
            The email was rejected due to an unknown reason.
          </li>
        </ul>

        <h3 className="text-[14px] font-semibold text-fg mb-3">
          What does risk level mean?
        </h3>
        <p className="text-[13px] text-fg-2 mb-6">
          Maintaining a bounce rate over <strong className="text-fg">4%</strong>{" "}
          may result in a temporary pause in sending until it is reduced.
        </p>

        <h3 className="text-[14px] font-semibold text-fg mb-3">
          How is it calculated?
        </h3>
        <div className="bg-bg-card rounded-lg p-4 mb-6 font-mono text-[12px] text-fg-2">
          <div>Bounce Rate = (Permanent</div>
          <div className="ml-16">+ Transient</div>
          <div className="ml-16">+ Undetermined Bounces)</div>
          <div className="ml-16">/ Emails Sent × 100</div>
        </div>

        <h3 className="text-[14px] font-semibold text-fg mb-3">
          Useful Articles
        </h3>
        <div className="space-y-0 border-t border-line">
          <a
            href="https://resend.com/docs/knowledge-base/tips-to-reduce-bounces"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-3 border-b border-line text-[13px] text-fg hover:text-white transition-colors"
          >
            Tips to reduce bounces
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </a>
          <a
            href="https://resend.com/docs/knowledge-base/email-bounces"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-3 border-b border-line text-[13px] text-fg hover:text-white transition-colors"
          >
            Email Bounces
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

// ── SVG Chart (0-8% Y-axis) ──────────────────────────────────────

function BounceRateChart({ data }: { data: DailyBouncePoint[] }) {
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

  // Y-axis max is 8% for bounce rate
  const yMax = 8;
  const yTicks = [0, 2, 4, 6, 8];

  const xScale = (i: number) =>
    paddingLeft + (i / Math.max(data.length - 1, 1)) * plotWidth;
  const yScale = (v: number) =>
    paddingTop + plotHeight - (v / yMax) * plotHeight;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.rate)}`)
    .join(" ");

  const areaPath = `${linePath} L ${xScale(data.length - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`;

  return (
    <svg
      role="application"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="bounceAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0.02" />
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
            {tick}%
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#bounceAreaGradient)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke="#EF4444"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={d.date}
          cx={xScale(i)}
          cy={yScale(d.rate)}
          r="3"
          fill="#EF4444"
          className="opacity-0 hover:opacity-100 transition-opacity"
        />
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => {
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

// ── Breakdown Table ──────────────────────────────────────────────

function BounceBreakdownTable({
  permanent,
  transient,
  undetermined,
  sent,
  dateRange,
}: {
  permanent: number;
  transient: number;
  undetermined: number;
  sent: number;
  dateRange: string;
}) {
  const { startDate, endDate } = getDateRangeParams(dateRange);
  const baseHref = `/emails?statuses=bounced&startDate=${startDate}&endDate=${endDate}`;

  const rows = [
    {
      label: "Transient",
      count: transient,
      rate: sent > 0 ? Math.round((transient / sent) * 10000) / 100 : 0,
    },
    {
      label: "Permanent",
      count: permanent,
      rate: sent > 0 ? Math.round((permanent / sent) * 10000) / 100 : 0,
    },
    {
      label: "Undetermined",
      count: undetermined,
      rate: sent > 0 ? Math.round((undetermined / sent) * 10000) / 100 : 0,
    },
  ];

  return (
    <div className="mt-4 border-t border-line pt-4">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-2">
          <a href={baseHref} className="text-[13px] text-fg hover:underline">
            {row.label}
          </a>
          <span className="text-[13px] text-fg">{row.rate}%</span>
        </div>
      ))}
    </div>
  );
}

// ── BounceRateSection ────────────────────────────────────────────

export function BounceRateSection({
  data,
  loading,
  dateRange,
}: BounceRateSectionProps) {
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  return (
    <div>
      {/* Info button row */}
      <div className="flex items-center justify-end mb-4">
        <button
          type="button"
          aria-label="Bounce rate info"
          onClick={() => setInfoPanelOpen(true)}
          className="text-fg-2 hover:text-fg transition-colors"
        >
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
        </button>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-fg-2 text-[13px]">
          Loading...
        </div>
      ) : (
        <BounceRateChart data={data.dailyBounceData} />
      )}

      {/* Breakdown table */}
      {!loading && (
        <BounceBreakdownTable
          permanent={data.permanent}
          transient={data.transient}
          undetermined={data.undetermined}
          sent={data.sent}
          dateRange={dateRange}
        />
      )}

      {/* Info panel overlay */}
      {infoPanelOpen && (
        <BounceInfoPanel onClose={() => setInfoPanelOpen(false)} />
      )}
    </div>
  );
}
