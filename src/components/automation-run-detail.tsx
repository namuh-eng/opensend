"use client";

import { formatDuration } from "@/components/automation-runs-list";
import { formatRelativeTime } from "@/components/emails-sending-data-table";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface RunStepState {
  status: string;
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
  error?: string;
  output?: Record<string, unknown>;
}

interface AutomationRunDetailPayload {
  id: string;
  automation_id: string;
  trigger_event_id: string | null;
  contact_id: string | null;
  status: string;
  current_step_key: string | null;
  failed_step_key: string | null;
  failure_reason: string | null;
  step_states: Record<string, RunStepState>;
  started_at: string | null;
  completed_at: string | null;
  next_step_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  automationId: string;
  runId: string;
}

const CANCELLABLE_RUN_STATUSES = new Set(["queued", "waiting"]);
const SENSITIVE_OUTPUT_KEYS = [
  "payload",
  "email",
  "token",
  "secret",
  "password",
  "authorization",
  "headers",
  "body",
];

function apiHeaders(contentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = "application/json";
  return headers;
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return `${formatRelativeTime(value)} · ${new Date(value).toLocaleString()}`;
}

function isSensitiveOutputKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_OUTPUT_KEYS.some((token) => lowered.includes(token));
}

function summarizeUnknown(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value))
    return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") {
    const keyCount = Object.keys(value as Record<string, unknown>).length;
    return `${keyCount} key${keyCount === 1 ? "" : "s"}`;
  }
  return "—";
}

function outputSummaryRows(output: Record<string, unknown> | undefined) {
  if (!output || Object.keys(output).length === 0) return [];
  return Object.entries(output).map(([key, value]) => {
    if (key === "payload" && typeof value === "object" && value !== null) {
      const keys = Object.keys(value as Record<string, unknown>);
      return {
        key,
        value: `Hidden event payload (${keys.length} key${keys.length === 1 ? "" : "s"})`,
      };
    }
    if (isSensitiveOutputKey(key)) {
      return { key, value: "Redacted" };
    }
    return { key, value: summarizeUnknown(value) };
  });
}

function OutputSummary({
  value,
}: { value: Record<string, unknown> | undefined }) {
  const rows = outputSummaryRows(value);
  if (rows.length === 0) return <span>—</span>;
  return (
    <dl className="mt-3 grid grid-cols-1 gap-2 rounded-md border border-[rgba(176,199,217,0.145)] bg-black/20 p-3 text-[12px] md:grid-cols-2">
      {rows.map((row) => (
        <div key={row.key}>
          <dt className="text-[#666]">{row.key}</dt>
          <dd className="break-words text-[#A1A4A5]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AutomationRunDetail({ automationId, runId }: Props) {
  const [run, setRun] = useState<AutomationRunDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(
        `/api/automations/${automationId}/runs/${runId}`,
        {
          headers: apiHeaders(),
        },
      );
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError("Failed to load run.");
        return;
      }
      setRun((await res.json()) as AutomationRunDetailPayload);
    } catch {
      setError("Failed to load run.");
    } finally {
      setLoading(false);
    }
  }, [automationId, runId]);

  useEffect(() => {
    let cancelled = false;
    async function guardedLoadRun() {
      await loadRun();
      if (cancelled) return;
    }
    guardedLoadRun();
    return () => {
      cancelled = true;
    };
  }, [loadRun]);

  const cancelRun = async () => {
    setCancelling(true);
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
      setRun((await res.json()) as AutomationRunDetailPayload);
    } catch {
      setError("Could not cancel run.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-[14px] text-[#A1A4A5]">
        Loading run...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <h1 className="mb-2 text-[18px] font-semibold text-[#F0F0F0]">
          Run not found
        </h1>
        <Link
          href={`/automations/${automationId}`}
          className="text-[13px] text-[#A1A4A5] underline hover:text-[#F0F0F0]"
        >
          Back to automation
        </Link>
      </div>
    );
  }

  if (error && !run) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
        >
          {error}
        </p>
      </div>
    );
  }

  if (!run) {
    return null;
  }

  const stepEntries = Object.entries(run.step_states);
  const canCancel = CANCELLABLE_RUN_STATUSES.has(run.status);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link
            href={`/automations/${automationId}`}
            className="text-[12px] text-[#A1A4A5] hover:text-[#F0F0F0]"
          >
            &larr; Back to automation
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[#F0F0F0]">
            Run {run.id}
          </h1>
          <p className="mt-1 text-[13px] text-[#A1A4A5]">
            {capitalize(run.status)} · {formatDuration(run.duration_ms)}
          </p>
        </div>
        {canCancel ? (
          <button
            type="button"
            disabled={cancelling}
            onClick={cancelRun}
            className="h-9 rounded-md border border-red-500/30 px-3 text-[13px] font-medium text-red-200 transition-colors hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Cancel run"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
        >
          {error}
        </p>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          ["Started", formatDate(run.started_at)],
          ["Finished", formatDate(run.completed_at)],
          ["Waiting until", formatDate(run.next_step_at)],
          ["Current step", run.current_step_key ?? "—"],
          ["Failed step", run.failed_step_key ?? "—"],
          ["Failure reason", run.failure_reason ?? "—"],
          ["Trigger event", run.trigger_event_id ?? "—"],
          ["Contact", run.contact_id ?? "—"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-[rgba(176,199,217,0.145)] p-4"
          >
            <div className="text-[12px] text-[#A1A4A5]">{label}</div>
            <div className="mt-1 break-words text-[14px] text-[#F0F0F0]">
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-[rgba(176,199,217,0.145)]">
        <div className="border-b border-[rgba(176,199,217,0.145)] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#F0F0F0]">
            Step states
          </h2>
          <p className="mt-1 text-[12px] text-[#A1A4A5]">
            Outputs are summarized and sensitive payload-like fields are
            redacted.
          </p>
        </div>
        {stepEntries.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-[#A1A4A5]">
            No step-level state has been recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-[rgba(176,199,217,0.145)]">
            {stepEntries.map(([key, state]) => (
              <div key={key} className="p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-[14px] font-semibold text-[#F0F0F0]">
                    {key}
                  </h3>
                  <span className="rounded-full border border-[rgba(176,199,217,0.145)] px-2 py-0.5 text-[12px] text-[#A1A4A5]">
                    {capitalize(state.status)}
                  </span>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-[13px] md:grid-cols-3">
                  <div>
                    <dt className="text-[#666]">Started</dt>
                    <dd className="text-[#A1A4A5]">
                      {formatDate(state.startedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#666]">Completed</dt>
                    <dd className="text-[#A1A4A5]">
                      {formatDate(state.completedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#666]">Scheduled</dt>
                    <dd className="text-[#A1A4A5]">
                      {formatDate(state.scheduledFor)}
                    </dd>
                  </div>
                </dl>
                {state.error ? (
                  <p className="mt-3 text-[13px] text-red-300">{state.error}</p>
                ) : null}
                <OutputSummary value={state.output} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
