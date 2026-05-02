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

const RUN_STATUSES = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "skipped",
] as const;

function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage?.getItem?.("api_key") ?? null;
  } catch {
    return null;
  }
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

interface Props {
  automationId: string;
}

export function AutomationRunsList({ automationId }: Props) {
  const [runs, setRuns] = useState<AutomationRunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const apiKey = getApiKey();
      const headers: Record<string, string> = {};
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch(
        `/api/automations/${automationId}/runs?${params.toString()}`,
        { headers },
      );
      if (!res.ok) {
        setRuns([]);
        setError(
          res.status === 401
            ? "Set an API key to view runs."
            : "Failed to load runs.",
        );
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
    const onClick = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative" ref={statusRef}>
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            className="h-9 px-3 text-[13px] border border-[rgba(176,199,217,0.145)] rounded-md text-[#A1A4A5] hover:text-[#F0F0F0] hover:border-[rgba(176,199,217,0.3)] transition-colors flex items-center gap-1.5 min-w-[140px]"
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
              className="absolute top-full left-0 mt-1 w-[200px] bg-[#0a0a0a] border border-[rgba(176,199,217,0.145)] rounded-md shadow-lg z-50 py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStatusFilter("");
                  setStatusOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-[rgba(176,199,217,0.08)] transition-colors ${!statusFilter ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
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
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-[rgba(176,199,217,0.08)] transition-colors ${statusFilter === s ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
                >
                  {capitalize(s)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={fetchRuns}
          className="h-9 px-3 text-[13px] border border-[rgba(176,199,217,0.145)] rounded-md text-[#A1A4A5] hover:text-[#F0F0F0] hover:border-[rgba(176,199,217,0.3)] transition-colors"
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
          <h3 className="text-[14px] font-semibold text-[#F0F0F0] mb-1">
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
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-b border-[rgba(176,199,217,0.145)] hover:bg-[rgba(24,25,28,0.5)] transition-colors"
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
                <td className="px-3 py-2 text-[14px] text-red-300 max-w-[280px] truncate">
                  {run.failure_reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
