"use client";

import {
  type AutomationAdvancedStepType,
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

const ADVANCED_STEP_OPTIONS: Array<{
  value: AutomationAdvancedStepType;
  label: string;
  description: string;
}> = [
  {
    value: "condition",
    label: "Condition branch",
    description: "Continue to email only when one predicate matches.",
  },
  {
    value: "wait_for_event",
    label: "Wait for event",
    description: "Pause this run until the same contact emits another event.",
  },
  {
    value: "contact_update",
    label: "Update contact",
    description: "Set safe first-class contact fields or custom properties.",
  },
  {
    value: "add_to_segment",
    label: "Add to segment",
    description: "Add the current contact to an existing segment by ID.",
  },
  {
    value: "contact_delete",
    label: "Delete contact",
    description: "Permanently delete the matched contact and finish the run.",
  },
];

interface FieldErrorProps {
  errors: AutomationFormValidationError[];
  field: keyof AutomationFormState;
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

function FieldError({ errors, field }: FieldErrorProps) {
  const error = findError(errors, field);
  if (!error) return null;
  return <span className="mt-1 block text-[12px] text-red-400">{error}</span>;
}

function stepNumber(
  state: AutomationFormState,
  step: "advanced" | "send" | "end",
) {
  const delayOffset = state.delayEnabled ? 1 : 0;
  const advancedOffset = state.advancedStepEnabled ? 1 : 0;
  if (step === "advanced") return 3 + delayOffset;
  if (step === "send") return 3 + delayOffset + advancedOffset;
  if (
    state.advancedStepEnabled &&
    state.advancedStepType === "contact_delete"
  ) {
    return 3 + delayOffset + advancedOffset;
  }
  return 4 + delayOffset + advancedOffset;
}

function AdvancedStepFields({
  state,
  update,
  errors,
}: {
  state: AutomationFormState;
  update: (patch: Partial<AutomationFormState>) => void;
  errors: AutomationFormValidationError[];
}) {
  if (!state.advancedStepEnabled) {
    return (
      <p className="text-[13px] text-[#666]">
        Keep the MVP linear path, or add one supported advanced step without
        changing the full canvas engine.
      </p>
    );
  }

  if (state.advancedStepType === "condition") {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block md:col-span-1">
          <span className="text-[13px] text-[#A1A4A5]">Left side</span>
          <input
            type="text"
            value={state.conditionLeft}
            onChange={(e) => update({ conditionLeft: e.target.value })}
            placeholder="event.plan"
            className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            aria-invalid={Boolean(findError(errors, "conditionLeft"))}
          />
          <FieldError errors={errors} field="conditionLeft" />
        </label>
        <label className="block">
          <span className="text-[13px] text-[#A1A4A5]">Operator</span>
          <select
            value={state.conditionOperator}
            onChange={(e) =>
              update({
                conditionOperator: e.target
                  .value as AutomationFormState["conditionOperator"],
              })
            }
            className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
          >
            <option value="equals">Equals</option>
            <option value="not_equals">Does not equal</option>
            <option value="greater_than">Greater than</option>
            <option value="greater_than_or_equal">Greater than or equal</option>
            <option value="less_than">Less than</option>
            <option value="less_than_or_equal">Less than or equal</option>
            <option value="contains">Contains</option>
            <option value="exists">Exists</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[13px] text-[#A1A4A5]">Right value</span>
          <input
            type="text"
            value={state.conditionRight}
            disabled={state.conditionOperator === "exists"}
            onChange={(e) => update({ conditionRight: e.target.value })}
            placeholder="pro"
            className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)] disabled:opacity-50"
            aria-invalid={Boolean(findError(errors, "conditionRight"))}
          />
          <span className="mt-1 block text-[12px] text-[#666]">
            true, false, null, and numbers are sent as scalar values; other
            input is sent as text.
          </span>
          <FieldError errors={errors} field="conditionRight" />
        </label>
        <p className="md:col-span-3 text-[12px] text-[#A1A4A5]">
          Matching contacts follow the email path. Non-matches skip to End.
        </p>
      </div>
    );
  }

  if (state.advancedStepType === "wait_for_event") {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-[13px] text-[#A1A4A5]">Event to wait for</span>
          <input
            type="text"
            value={state.waitForEventName}
            onChange={(e) => update({ waitForEventName: e.target.value })}
            placeholder="invoice.paid"
            className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            aria-invalid={Boolean(findError(errors, "waitForEventName"))}
          />
          <FieldError errors={errors} field="waitForEventName" />
        </label>
        <label className="block">
          <span className="text-[13px] text-[#A1A4A5]">
            Timeout seconds (optional)
          </span>
          <input
            type="number"
            min={1}
            value={state.waitForEventTimeoutSeconds}
            onChange={(e) =>
              update({ waitForEventTimeoutSeconds: e.target.value })
            }
            placeholder="86400"
            className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            aria-invalid={Boolean(
              findError(errors, "waitForEventTimeoutSeconds"),
            )}
          />
          <span className="mt-1 block text-[12px] text-[#666]">
            Leave blank to wait indefinitely. Max 30 days.
          </span>
          <FieldError errors={errors} field="waitForEventTimeoutSeconds" />
        </label>
      </div>
    );
  }

  if (state.advancedStepType === "contact_update") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-[13px] text-[#A1A4A5]">Email</span>
            <input
              type="email"
              value={state.contactUpdateEmail}
              onChange={(e) => update({ contactUpdateEmail: e.target.value })}
              placeholder="optional"
              className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
              aria-invalid={Boolean(findError(errors, "contactUpdateEmail"))}
            />
            <FieldError errors={errors} field="contactUpdateEmail" />
          </label>
          <label className="block">
            <span className="text-[13px] text-[#A1A4A5]">Unsubscribed</span>
            <select
              value={state.contactUpdateUnsubscribed}
              onChange={(e) =>
                update({
                  contactUpdateUnsubscribed: e.target
                    .value as AutomationFormState["contactUpdateUnsubscribed"],
                })
              }
              className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            >
              <option value="">Leave unchanged</option>
              <option value="false">Subscribed</option>
              <option value="true">Unsubscribed</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[13px] text-[#A1A4A5]">First name</span>
            <input
              type="text"
              value={state.contactUpdateFirstName}
              onChange={(e) =>
                update({ contactUpdateFirstName: e.target.value })
              }
              placeholder="optional"
              className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            />
          </label>
          <label className="block">
            <span className="text-[13px] text-[#A1A4A5]">Last name</span>
            <input
              type="text"
              value={state.contactUpdateLastName}
              onChange={(e) =>
                update({ contactUpdateLastName: e.target.value })
              }
              placeholder="optional"
              className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-[13px] text-[#A1A4A5]">
            Custom properties JSON
          </span>
          <textarea
            value={state.contactUpdatePropertiesJson}
            onChange={(e) =>
              update({ contactUpdatePropertiesJson: e.target.value })
            }
            placeholder={'{"plan":"pro","score":42}'}
            rows={3}
            className="mt-1 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 py-2 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            aria-invalid={Boolean(
              findError(errors, "contactUpdatePropertiesJson"),
            )}
          />
          <span className="mt-1 block text-[12px] text-[#666]">
            Reserved identity, segment, topic, and unsubscribe keys are blocked
            from properties.
          </span>
          <FieldError errors={errors} field="contactUpdatePropertiesJson" />
        </label>
      </div>
    );
  }

  if (state.advancedStepType === "add_to_segment") {
    return (
      <label className="block">
        <span className="text-[13px] text-[#A1A4A5]">Segment ID</span>
        <input
          type="text"
          value={state.addToSegmentId}
          onChange={(e) => update({ addToSegmentId: e.target.value })}
          placeholder="00000000-0000-0000-0000-000000000000"
          className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
          aria-invalid={Boolean(findError(errors, "addToSegmentId"))}
        />
        <span className="mt-1 block text-[12px] text-[#666]">
          This uses the existing segment UUID contract; no segment is created
          here.
        </span>
        <FieldError errors={errors} field="addToSegmentId" />
      </label>
    );
  }

  return (
    <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
      <p className="text-[13px] font-medium text-red-200">
        Destructive step: delete matched contact
      </p>
      <p className="mt-1 text-[12px] text-red-200/80">
        This automation will permanently delete the contact matched to the run,
        clear the run contact reference, and finish immediately. The email step
        is skipped for this bounded builder slice.
      </p>
      <label className="mt-3 flex items-start gap-2 text-[12px] text-red-100">
        <input
          type="checkbox"
          checked={state.contactDeleteConfirmed}
          onChange={(e) => update({ contactDeleteConfirmed: e.target.checked })}
          className="mt-0.5 accent-red-400"
        />
        I understand this can remove customer data and should only be enabled
        for intentionally destructive cleanup automations.
      </label>
      <FieldError errors={errors} field="contactDeleteConfirmed" />
    </div>
  );
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
  const includesSendEmail = !(
    state.advancedStepEnabled && state.advancedStepType === "contact_delete"
  );

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
      <div className="space-y-4 rounded-lg border border-[rgba(176,199,217,0.145)] p-5">
        <h2 className="text-[14px] font-semibold text-[#F0F0F0]">Settings</h2>
        <label className="block">
          <span className="text-[13px] text-[#A1A4A5]">Name</span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
            className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
            aria-invalid={Boolean(findError(errors, "name"))}
          />
          <FieldError errors={errors} field="name" />
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
              className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
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
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] px-2 py-0.5 text-[11px] font-semibold text-[#A1A4A5]">
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
              className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
              aria-invalid={Boolean(findError(errors, "triggerEventName"))}
            />
            <FieldError errors={errors} field="triggerEventName" />
          </label>
        </li>

        <li
          className="rounded-lg border border-[rgba(176,199,217,0.145)] p-5"
          data-step="delay"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] px-2 py-0.5 text-[11px] font-semibold text-[#A1A4A5]">
              2
            </span>
            <h3 className="text-[14px] font-semibold text-[#F0F0F0]">Delay</h3>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[12px] text-[#A1A4A5]">
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
                className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
                aria-invalid={Boolean(findError(errors, "delayDuration"))}
              />
              <span className="mt-1 block text-[12px] text-[#666]">
                Examples: 30 minutes, 1 hour, 3 days. Max 30 days.
              </span>
              <FieldError errors={errors} field="delayDuration" />
            </label>
          ) : (
            <p className="text-[13px] text-[#666]">
              Skip the delay to send immediately when the event arrives.
            </p>
          )}
        </li>

        <li
          className="rounded-lg border border-[rgba(176,199,217,0.145)] p-5"
          data-step="advanced"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] px-2 py-0.5 text-[11px] font-semibold text-[#A1A4A5]">
              {stepNumber(state, "advanced")}
            </span>
            <h3 className="text-[14px] font-semibold text-[#F0F0F0]">
              Advanced step
            </h3>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[12px] text-[#A1A4A5]">
              <input
                type="checkbox"
                checked={state.advancedStepEnabled}
                onChange={(e) =>
                  update({ advancedStepEnabled: e.target.checked })
                }
                className="accent-white"
              />
              Add advanced step
            </label>
          </div>
          {state.advancedStepEnabled ? (
            <div className="mb-4">
              <label className="block">
                <span className="text-[13px] text-[#A1A4A5]">Step type</span>
                <select
                  value={state.advancedStepType}
                  onChange={(e) =>
                    update({
                      advancedStepType: e.target
                        .value as AutomationAdvancedStepType,
                      contactDeleteConfirmed: false,
                    })
                  }
                  className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
                >
                  {ADVANCED_STEP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-2 text-[12px] text-[#666]">
                {
                  ADVANCED_STEP_OPTIONS.find(
                    (option) => option.value === state.advancedStepType,
                  )?.description
                }
              </p>
            </div>
          ) : null}
          <AdvancedStepFields state={state} update={update} errors={errors} />
        </li>

        {includesSendEmail ? (
          <li
            className="rounded-lg border border-[rgba(176,199,217,0.145)] p-5"
            data-step="send_email"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="rounded-full border border-[rgba(176,199,217,0.3)] px-2 py-0.5 text-[11px] font-semibold text-[#A1A4A5]">
                {stepNumber(state, "send")}
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
                className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
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
              <FieldError errors={errors} field="templateId" />
            </label>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-[13px] text-[#A1A4A5]">
                  From override
                </span>
                <input
                  type="text"
                  value={state.fromOverride}
                  onChange={(e) => update({ fromOverride: e.target.value })}
                  placeholder="optional"
                  className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
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
                  className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
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
                  className="mt-1 h-9 w-full rounded-md border border-[rgba(176,199,217,0.145)] bg-transparent px-3 text-[13px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)]"
                />
              </label>
            </div>
          </li>
        ) : null}

        <li
          className="rounded-lg border border-dashed border-[rgba(176,199,217,0.145)] p-5"
          data-step="end"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[rgba(176,199,217,0.3)] px-2 py-0.5 text-[11px] font-semibold text-[#A1A4A5]">
              {stepNumber(state, "end")}
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
