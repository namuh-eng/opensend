"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AutomationRunListItem {
  id: string;
  automation_id: string;
  status: string;
  current_step_key: string | null;
  failed_step_key: string | null;
  started_at: string | null;
  completed_at: string | null;
  next_step_at: string | null;
  duration_ms: number | null;
  failure_reason: string | null;
  created_at: string;
}

interface AutomationRunMetrics {
  total_runs: number;
  by_status: Record<string, number>;
  completion_rate: number;
  failure_rate: number;
  average_duration_ms: number | null;
  waiting_count: number;
  failed_steps: Array<{ step_key: string; count: number }>;
}

const RUN_STATUSES = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "skipped",
] as const;
const CANCELLABLE_RUN_STATUSES = new Set(["queued", "waiting"]);

function apiHeaders(contentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = "application/json";
  return headers;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return remSec ? `${min}m ${remSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[rgba(176,199,217,0.145)] p-3">
      <div className="text-[12px] text-[#A1A4A5]">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-[#F0F0F0]">
        {value}
      </div>
    </div>
  );
}

interface Props {
  automationId: string;
}

export function AutomationRunsList({ automationId }: Props) {
  const [runs, setRuns] = useState<AutomationRunListItem[]>([]);
  const [metrics, setMetrics] = useState<AutomationRunMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const res = await fetch(`/api/automations/${automationId}/runs/metrics`, {
        headers: apiHeaders(),
      });
      if (!res.ok) {
        setMetrics(null);
        setMetricsError("Failed to load run metrics.");
        return;
      }
      setMetrics((await res.json()) as AutomationRunMetrics);
    } catch {
      setMetrics(null);
      setMetricsError("Failed to load run metrics.");
    } finally {
      setMetricsLoading(false);
    }
  }, [automationId]);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const query = params.toString();
      const res = await fetch(
        `/api/automations/${automationId}/runs${query ? `?${query}` : ""}`,
        { headers: apiHeaders() },
      );
      if (!res.ok) {
        setRuns([]);
        setError("Failed to load runs.");
        return;
      }
      const data = await res.json();
      setRuns(data.data ?? []);
    } catch {
      setRuns([]);
      setError("Failed to load runs.");
    } finally {
      setLoading(false);
    }
  }, [automationId, statusFilter]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const refreshAll = async () => {
    await Promise.all([fetchRuns(), fetchMetrics()]);
  };

  const cancelRun = async (runId: string) => {
    setCancellingRunId(runId);
    setError(null);
    try {
      const res = await fetch(
        `/api/automations/${automationId}/runs/${runId}/cancel`,
        {
          method: "POST",
          headers: apiHeaders(true),
          body: JSON.stringify({ reason: "cancelled_from_dashboard" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Could not cancel run.");
        return;
      }
      await refreshAll();
    } catch {
      setError("Could not cancel run.");
    } finally {
      setCancellingRunId(null);
    }
  };

  return (
    <div>
      <section className="mb-5 rounded-lg border border-[rgba(176,199,217,0.145)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-[#F0F0F0]">
              Run metrics
            </h3>
            <p className="mt-1 text-[12px] text-[#A1A4A5]">
              Aggregated from the automation run metrics endpoint.
            </p>
          </div>
          {metricsLoading ? (
            <span className="text-[12px] text-[#666]">Loading metrics...</span>
          ) : null}
        </div>
        {metricsError ? (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {metricsError}
          </p>
        ) : metrics ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <MetricCard
                label="Total runs"
                value={String(metrics.total_runs)}
              />
              <MetricCard
                label="Completion"
                value={formatPercent(metrics.completion_rate)}
              />
              <MetricCard
                label="Failure"
                value={formatPercent(metrics.failure_rate)}
              />
              <MetricCard
                label="Waiting"
                value={String(metrics.waiting_count)}
              />
              <MetricCard
                label="Avg duration"
                value={formatDuration(metrics.average_duration_ms)}
              />
            </div>
            {metrics.failed_steps.length > 0 ? (
              <div className="text-[12px] text-[#A1A4A5]">
                Top failed steps:{" "}
                {metrics.failed_steps
                  .map((step) => `${step.step_key} (${step.count})`)
                  .join(", ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative" ref={statusRef}>
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            className="flex h-9 min-w-[140px] items-center gap-1.5 rounded-md border border-[rgba(176,199,217,0.145)] px-3 text-[13px] text-[#A1A4A5] transition-colors hover:border-[rgba(176,199,217,0.3)] hover:text-[#F0F0F0]"
          >
            <span>
              {statusFilter ? capitalize(statusFilter) : "All Statuses"}
            </span>
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="ml-auto"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {statusOpen ? (
            <div
              role="menu"
              className="absolute top-full left-0 z-50 mt-1 w-[200px] rounded-md border border-[rgba(176,199,217,0.145)] bg-[#0a0a0a] py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStatusFilter("");
                  setStatusOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[rgba(176,199,217,0.08)] ${!statusFilter ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
              >
                All Statuses
              </button>
              {RUN_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  role="menuitem"
                  onClick={() => {
                    setStatusFilter(s);
                    setStatusOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[rgba(176,199,217,0.08)] ${statusFilter === s ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
                >
                  {capitalize(s)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="h-9 rounded-md border border-[rgba(176,199,217,0.145)] px-3 text-[13px] text-[#A1A4A5] transition-colors hover:border-[rgba(176,199,217,0.3)] hover:text-[#F0F0F0]"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[14px] text-[#A1A4A5]">
          Loading runs...
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-md border border-dashed border-[rgba(176,199,217,0.145)] py-12 px-6 text-center">
          <h3 className="mb-1 text-[14px] font-semibold text-[#F0F0F0]">
            No runs yet
          </h3>
          <p className="text-[13px] text-[#A1A4A5]">
            Send a matching event with `POST /api/events/send` to trigger this
            automation.
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[rgba(176,199,217,0.145)]">
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5]">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5]">
                Started
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5]">
                Duration
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5]">
                Current step
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5]">
                Failed step
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5]">
                Failure reason
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const cancellable = CANCELLABLE_RUN_STATUSES.has(run.status);
              return (
                <tr
                  key={run.id}
                  className="border-b border-[rgba(176,199,217,0.145)] transition-colors hover:bg-[rgba(24,25,28,0.5)]"
                >
                  <td className="px-3 py-2 text-[14px] text-[#F0F0F0]">
                    <Link
                      href={`/automations/${automationId}/runs/${run.id}`}
                      className="hover:underline"
                    >
                      {capitalize(run.status)}
                    </Link>
                  </td>
                  <td
                    className="px-3 py-2 text-[14px] text-[#A1A4A5]"
                    title={
                      run.started_at
                        ? new Date(run.started_at).toLocaleString()
                        : ""
                    }
                  >
                    {run.started_at
                      ? formatRelativeTime(run.started_at)
                      : run.next_step_at
                        ? `Scheduled ${formatRelativeTime(run.next_step_at)}`
                        : formatRelativeTime(run.created_at)}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-[#A1A4A5]">
                    {formatDuration(run.duration_ms)}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-[#A1A4A5]">
                    {run.current_step_key ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-red-300">
                    {run.failed_step_key ?? "—"}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-[14px] text-red-300">
                    {run.failure_reason ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-[#A1A4A5]">
                    {cancellable ? (
                      <button
                        type="button"
                        disabled={cancellingRunId === run.id}
                        onClick={() => cancelRun(run.id)}
                        className="rounded-md border border-red-500/30 px-2 py-1 text-[12px] text-red-200 transition-colors hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cancellingRunId === run.id
                          ? "Cancelling..."
                          : "Cancel"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
