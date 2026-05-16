"use client";

import { AutomationBuilderForm } from "@/components/automation-builder-form";
import { AutomationRunsList } from "@/components/automation-runs-list";
import { formatRelativeTime } from "@/components/emails-sending-data-table";
import {
  type ApiAutomation,
  type AutomationFormState,
  DEFAULT_FORM_STATE,
  buildConnections,
  buildSteps,
  fromAutomation,
  validateFormState,
} from "@/lib/automations/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Props {
  automationId: string;
}

type Tab = "steps" | "runs";

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function AutomationDetail({ automationId }: Props) {
  const router = useRouter();
  const [automation, setAutomation] = useState<ApiAutomation | null>(null);
  const [state, setState] = useState<AutomationFormState>(DEFAULT_FORM_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>("steps");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/automations/${automationId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError("Failed to load automation.");
        return;
      }
      const data: ApiAutomation = await res.json();
      setAutomation(data);
      setState(fromAutomation(data));
    } catch {
      setError("Failed to load automation.");
    } finally {
      setLoading(false);
    }
  }, [automationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const errors = validateFormState(state);
  const canSave = errors.length === 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          name: state.name,
          status: state.status,
          triggerEventName: state.triggerEventName,
          steps: buildSteps(state),
          connections: buildConnections(state),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Could not save automation.");
        return;
      }
      const data: ApiAutomation = await res.json();
      setAutomation(data);
      setState(fromAutomation(data));
    } catch {
      setError("Could not save automation.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Could not delete automation.");
        return;
      }
      router.push("/automations");
    } catch {
      setError("Could not delete automation.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
        Loading automation...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <h2 className="text-[18px] font-semibold text-fg mb-2">
          Automation not found
        </h2>
        <p className="text-[14px] text-fg-2 mb-6">
          It may have been deleted, or the link may be stale.
        </p>
        <Link
          href="/automations"
          className="text-[13px] text-fg-2 hover:text-fg underline"
        >
          Back to automations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/automations"
            className="text-[12px] text-fg-2 hover:text-fg"
          >
            &larr; All automations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-fg">
            {state.name || "Untitled automation"}
          </h1>
          <p className="mt-1 text-[13px] text-fg-2">
            Status: {capitalize(state.status)}
            {automation
              ? ` · Updated ${formatRelativeTime((automation as ApiAutomation & { updated_at?: string }).updated_at ?? new Date().toISOString())}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            className="h-9 px-3 text-[13px] font-medium border border-line text-fg-2 rounded-md hover:text-red-300 hover:border-red-500/40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-white/[0.12] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
        >
          {error}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="Automation sections"
        className="mb-6 flex gap-1 border-b border-line"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "steps"}
          onClick={() => setTab("steps")}
          className={`-mb-px px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${tab === "steps" ? "border-white text-fg" : "border-transparent text-fg-2 hover:text-fg"}`}
        >
          Steps
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "runs"}
          onClick={() => setTab("runs")}
          className={`-mb-px px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${tab === "runs" ? "border-white text-fg" : "border-transparent text-fg-2 hover:text-fg"}`}
        >
          Runs
        </button>
      </div>

      {tab === "steps" ? (
        <AutomationBuilderForm
          state={state}
          onChange={setState}
          formErrors={errors}
        />
      ) : (
        <AutomationRunsList automationId={automationId} />
      )}
    </div>
  );
}
