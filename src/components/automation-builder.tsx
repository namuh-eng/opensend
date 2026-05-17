"use client";

import { AutomationBuilderForm } from "@/components/automation-builder-form";
import {
  type AutomationFormState,
  DEFAULT_FORM_STATE,
  buildConnections,
  buildSteps,
  validateFormState,
} from "@/lib/automations/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  mode: "create";
}

export function AutomationBuilder({ mode }: Props) {
  const router = useRouter();
  const [state, setState] = useState<AutomationFormState>(DEFAULT_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validateFormState(state);
  const canSave = errors.length === 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const res = await fetch("/api/automations", {
        method: "POST",
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
        setError(body?.error ?? "Could not create automation.");
        return;
      }
      const data = await res.json();
      router.push(`/automations/${data.id}`);
    } catch {
      setError("Could not create automation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/automations"
            className="text-[12px] text-fg-2 hover:text-fg"
          >
            &larr; All automations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-fg">
            New automation
          </h1>
          <p className="mt-1 text-[13px] text-fg-2">
            Build a trigger path with optional delay, one advanced step, email,
            and end.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSave}
          className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Create automation"}
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

      <AutomationBuilderForm
        state={state}
        onChange={setState}
        showStatus={mode === "create"}
        formErrors={errors}
      />
    </div>
  );
}
