"use client";

import {
  type AutomationFormState,
  type AutomationFormValidationError,
  validateFormState,
} from "@/lib/automations/form";
import { useEffect, useState } from "react";

interface TemplateOption {
  id: string;
  name: string;
}

interface Props {
  state: AutomationFormState;
  onChange: (next: AutomationFormState) => void;
  showStatus?: boolean;
  formErrors?: AutomationFormValidationError[];
}

function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage?.getItem?.("api_key") ?? null;
  } catch {
    return null;
  }
}

function findError(
  errors: AutomationFormValidationError[],
  field: keyof AutomationFormState,
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function AutomationBuilderForm({
  state,
  onChange,
  showStatus = true,
  formErrors,
}: Props) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const errors = formErrors ?? validateFormState(state);

  useEffect(() => {
    let cancelled = false;
    async function loadTemplates() {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const apiKey = getApiKey();
        const headers: Record<string, string> = {};
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        const res = await fetch("/api/templates?status=published", { headers });
        if (!res.ok) {
          if (!cancelled) {
            setTemplates([]);
            setTemplatesError(
              res.status === 401
                ? "Set an API key to load published templates."
                : "Could not load templates.",
            );
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setTemplates(
          (data?.data ?? []).map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          })),
        );
      } catch {
        if (!cancelled) {
          setTemplates([]);
          setTemplatesError("Could not load templates.");
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<AutomationFormState>) =>
    onChange({ ...state, ...patch });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[rgba(176,199,217,0.145)] p-5 space-y-4">
        <h2 className="text-[14px] font-semibold text-[#F0F0F0]">Settings</h2>
        <label className="block">
          <span className="text-[13px] text-[#A1A4A5]">Name</span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            aria-invalid={Boolean(findError(errors, "name"))}
          />
          {findError(errors, "name") ? (
            <span className="mt-1 block text-[12px] text-red-400">
              {findError(errors, "name")}
            </span>
          ) : null}
        </label>
        {showStatus ? (
          <label className="block">
            <span className="text-[13px] text-[#A1A4A5]">Status</span>
            <select
              value={state.status}
              onChange={(e) =>
                update({
                  status: e.target.value as AutomationFormState["status"],
                })
              }
              className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            >
              <option value="draft">Draft</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        ) : null}
      </div>

      <ol className="space-y-3" aria-label="Automation steps">
        <li
          className="rounded-lg border border-[rgba(176,199,217,0.145)] p-5"
          data-step="trigger"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] text-[11px] font-semibold text-[#A1A4A5] px-2 py-0.5">
              1
            </span>
            <h3 className="text-[14px] font-semibold text-[#F0F0F0]">
              Trigger
            </h3>
            <span className="text-[12px] text-[#A1A4A5]">
              Run when this custom event arrives
            </span>
          </div>
          <label className="block">
            <span className="text-[13px] text-[#A1A4A5]">Event name</span>
            <input
              type="text"
              value={state.triggerEventName}
              onChange={(e) => update({ triggerEventName: e.target.value })}
              placeholder="user.signed_up"
              className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
              aria-invalid={Boolean(findError(errors, "triggerEventName"))}
            />
            {findError(errors, "triggerEventName") ? (
              <span className="mt-1 block text-[12px] text-red-400">
                {findError(errors, "triggerEventName")}
              </span>
            ) : null}
          </label>
        </li>

        <li
          className="rounded-lg border border-[rgba(176,199,217,0.145)] p-5"
          data-step="delay"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] text-[11px] font-semibold text-[#A1A4A5] px-2 py-0.5">
              2
            </span>
            <h3 className="text-[14px] font-semibold text-[#F0F0F0]">Delay</h3>
            <label className="ml-auto inline-flex items-center gap-2 text-[12px] text-[#A1A4A5] cursor-pointer">
              <input
                type="checkbox"
                checked={state.delayEnabled}
                onChange={(e) => update({ delayEnabled: e.target.checked })}
                className="accent-white"
              />
              Add a delay
            </label>
          </div>
          {state.delayEnabled ? (
            <label className="block">
              <span className="text-[13px] text-[#A1A4A5]">Duration</span>
              <input
                type="text"
                value={state.delayDuration}
                onChange={(e) => update({ delayDuration: e.target.value })}
                placeholder="1 hour"
                className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
                aria-invalid={Boolean(findError(errors, "delayDuration"))}
              />
              <span className="mt-1 block text-[12px] text-[#666]">
                Examples: 30 minutes, 1 hour, 3 days. Max 30 days.
              </span>
              {findError(errors, "delayDuration") ? (
                <span className="mt-1 block text-[12px] text-red-400">
                  {findError(errors, "delayDuration")}
                </span>
              ) : null}
            </label>
          ) : (
            <p className="text-[13px] text-[#666]">
              Skip the delay to send immediately when the event arrives.
            </p>
          )}
        </li>

        <li
          className="rounded-lg border border-[rgba(176,199,217,0.145)] p-5"
          data-step="send_email"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] text-[11px] font-semibold text-[#A1A4A5] px-2 py-0.5">
              {state.delayEnabled ? 3 : 2}
            </span>
            <h3 className="text-[14px] font-semibold text-[#F0F0F0]">
              Send email
            </h3>
            <span className="text-[12px] text-[#A1A4A5]">
              Use a published template
            </span>
          </div>
          <label className="block">
            <span className="text-[13px] text-[#A1A4A5]">
              Published template
            </span>
            <select
              value={state.templateId}
              onChange={(e) => update({ templateId: e.target.value })}
              className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
              aria-invalid={Boolean(findError(errors, "templateId"))}
            >
              <option value="">
                {templatesLoading
                  ? "Loading published templates..."
                  : "Select a published template"}
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {templatesError ? (
              <span className="mt-1 block text-[12px] text-red-400">
                {templatesError}
              </span>
            ) : null}
            {findError(errors, "templateId") ? (
              <span className="mt-1 block text-[12px] text-red-400">
                {findError(errors, "templateId")}
              </span>
            ) : null}
          </label>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[13px] text-[#A1A4A5]">From override</span>
              <input
                type="text"
                value={state.fromOverride}
                onChange={(e) => update({ fromOverride: e.target.value })}
                placeholder="optional"
                className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
              />
            </label>
            <label className="block">
              <span className="text-[13px] text-[#A1A4A5]">
                Subject override
              </span>
              <input
                type="text"
                value={state.subjectOverride}
                onChange={(e) => update({ subjectOverride: e.target.value })}
                placeholder="optional"
                className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[13px] text-[#A1A4A5]">
                Reply-to override
              </span>
              <input
                type="text"
                value={state.replyToOverride}
                onChange={(e) => update({ replyToOverride: e.target.value })}
                placeholder="optional"
                className="mt-1 w-full h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
              />
            </label>
          </div>
        </li>

        <li
          className="rounded-lg border border-dashed border-[rgba(176,199,217,0.145)] p-5"
          data-step="end"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] text-[11px] font-semibold text-[#A1A4A5] px-2 py-0.5">
              {state.delayEnabled ? 4 : 3}
            </span>
            <h3 className="text-[14px] font-semibold text-[#F0F0F0]">End</h3>
            <span className="text-[12px] text-[#A1A4A5]">
              Run finishes here
            </span>
          </div>
        </li>
      </ol>
    </div>
  );
}
