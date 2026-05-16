"use client";

import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import type { SupportedWebhookEventType } from "@opensend/core/src/webhook-events";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface Webhook {
  id: string;
  url: string;
  status: "active" | "disabled";
  eventTypes: string[];
  createdAt: string;
}

type CreatedWebhook = {
  id: string;
  endpoint: string;
  signingSecret: string | null;
};

function formatEventType(eventType: string): string {
  return eventType
    .replace(/^email\./, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isValidEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function WebhooksList({
  supportedEventTypes,
  webhooks,
}: {
  supportedEventTypes: readonly SupportedWebhookEventType[];
  webhooks: Webhook[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<
    SupportedWebhookEventType[]
  >([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdWebhook, setCreatedWebhook] = useState<CreatedWebhook | null>(
    null,
  );

  const canCreate = useMemo(
    () =>
      endpoint.trim().length > 0 &&
      isValidEndpoint(endpoint.trim()) &&
      selectedEvents.length > 0 &&
      !creating,
    [creating, endpoint, selectedEvents.length],
  );

  function openCreateModal() {
    setCreateOpen(true);
    setError(null);
  }

  function resetCreateForm() {
    setEndpoint("");
    setSelectedEvents([]);
    setError(null);
    setCreatedWebhook(null);
  }

  function closeCreateModal() {
    setCreateOpen(false);
    resetCreateForm();
    router.refresh();
  }

  function viewCreatedEndpoint() {
    const createdId = createdWebhook?.id;
    if (!createdId) return;

    setCreateOpen(false);
    resetCreateForm();
    router.push(`/webhooks/${createdId}`);
  }

  function toggleEvent(eventType: SupportedWebhookEventType) {
    setSelectedEvents((current) =>
      current.includes(eventType)
        ? current.filter((event) => event !== eventType)
        : [...current, eventType],
    );
  }

  async function handleCreateWebhook() {
    if (!canCreate) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: endpoint.trim(),
          events: selectedEvents,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        id?: unknown;
        endpoint?: unknown;
        signing_secret?: unknown;
        error?: unknown;
      };

      if (!response.ok) {
        setError(
          typeof body.error === "string"
            ? body.error
            : "Failed to create webhook endpoint.",
        );
        return;
      }

      if (typeof body.id !== "string" || typeof body.endpoint !== "string") {
        setError("Webhook endpoint was created, but the response was invalid.");
        return;
      }

      setCreatedWebhook({
        id: body.id,
        endpoint: body.endpoint,
        signingSecret:
          typeof body.signing_secret === "string" ? body.signing_secret : null,
      });
      router.refresh();
    } catch {
      setError("Failed to create webhook endpoint.");
    } finally {
      setCreating(false);
    }
  }

  function renderCreateModal() {
    if (createdWebhook) {
      return (
        <Modal
          open={createOpen}
          onClose={closeCreateModal}
          title="Webhook endpoint created"
          actionLabel="View endpoint"
          onAction={viewCreatedEndpoint}
        >
          <div className="space-y-4">
            <p className="text-[13px] text-fg-2">
              Your endpoint is active and ready to receive subscribed events.
              Copy the signing secret now; it is only shown once.
            </p>
            <div>
              <p className="mb-1 text-[12px] uppercase tracking-wider text-fg-3">
                Endpoint
              </p>
              <code className="block rounded-md border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg break-all">
                {createdWebhook.endpoint}
              </code>
            </div>
            <div>
              <p className="mb-1 text-[12px] uppercase tracking-wider text-fg-3">
                Signing secret
              </p>
              <code className="block rounded-md border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg break-all">
                {createdWebhook.signingSecret ?? "Unavailable"}
              </code>
            </div>
          </div>
        </Modal>
      );
    }

    return (
      <Modal
        open={createOpen}
        onClose={closeCreateModal}
        title="Add webhook endpoint"
        actionLabel={creating ? "Creating..." : "Create endpoint"}
        onAction={handleCreateWebhook}
        actionDisabled={!canCreate}
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="webhook-endpoint"
              className="mb-1.5 block text-[13px] text-fg"
            >
              Endpoint URL
            </label>
            <input
              id="webhook-endpoint"
              type="url"
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://example.com/webhooks/opensend"
              className="w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-[14px] text-fg outline-none placeholder:text-fg-4 focus:border-line-3"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-[13px] text-fg">Events</legend>
            <div className="grid max-h-60 gap-2 overflow-y-auto rounded-md border border-line bg-bg-2 p-3 sm:grid-cols-2">
              {supportedEventTypes.map((eventType) => (
                <label
                  key={eventType}
                  className="flex items-center gap-2 text-[13px] text-fg-2"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(eventType)}
                    onChange={() => toggleEvent(eventType)}
                    className="h-4 w-4 rounded border-line-2 bg-transparent"
                  />
                  <span>{eventType}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="text-[13px] text-red">
              {error}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-fg">Webhooks</h1>
        <button
          type="button"
          onClick={openCreateModal}
          className="btn btn-primary btn-sm"
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Add endpoint
        </button>
      </div>

      <section className="rounded-lg border border-line bg-bg-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-fg-3">
          Supported events
        </h2>
        <div
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Supported webhook events"
        >
          {supportedEventTypes.map((eventType) => (
            <span
              key={eventType}
              className="rounded-full border border-line-2 bg-white/[0.03] px-3 py-1 text-xs text-fg"
            >
              {eventType}
            </span>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-line bg-bg-card">
        <table className="min-w-full divide-y divide-line">
          <thead>
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-fg-3">
                Endpoint
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-fg-3">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-fg-3">
                Events
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-fg-3">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {webhooks.map((webhook) => (
              <tr key={webhook.id} className="hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-fg">
                  <Link
                    href={`/webhooks/${webhook.id}`}
                    className="hover:underline"
                  >
                    {webhook.url}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <StatusBadge
                    status={webhook.status === "active" ? "active" : "failed"}
                  />
                </td>
                <td className="px-6 py-4 text-sm text-fg-3">
                  {webhook.eventTypes
                    .filter((eventType) =>
                      supportedEventTypes.includes(
                        eventType as SupportedWebhookEventType,
                      ),
                    )
                    .map((eventType) => formatEventType(eventType))
                    .join(", ")}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-fg-3">
                  {new Date(webhook.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-sm text-fg-3"
                >
                  <div className="flex flex-col items-center gap-3">
                    <span>No webhooks configured.</span>
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="btn btn-ghost btn-sm"
                    >
                      Add your first endpoint
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {renderCreateModal()}
    </div>
  );
}
