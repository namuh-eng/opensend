"use client";

import { StatusBadge } from "@/components/status-badge";
import type { SupportedWebhookEventType } from "@opensend/core/src/webhook-events";
import Link from "next/link";

interface Webhook {
  id: string;
  url: string;
  status: "active" | "disabled";
  eventTypes: string[];
  createdAt: string;
}

function formatEventType(eventType: string): string {
  return eventType
    .replace(/^email\./, "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function WebhooksList({
  supportedEventTypes,
  webhooks,
}: {
  supportedEventTypes: SupportedWebhookEventType[];
  webhooks: Webhook[];
}) {
  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-lg border border-white/5 bg-black p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-white/40">
          Supported events
        </h2>
        <div
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Supported webhook events"
        >
          {supportedEventTypes.map((eventType) => (
            <span
              key={eventType}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-[#F0F0F0]"
            >
              {eventType}
            </span>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-white/5 bg-black">
        <table className="min-w-full divide-y divide-white/5">
          <thead>
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                Endpoint
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                Events
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {webhooks.map((webhook) => (
              <tr key={webhook.id} className="hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-[#F0F0F0]">
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
                <td className="px-6 py-4 text-sm text-white/40">
                  {webhook.eventTypes
                    .filter((eventType) =>
                      supportedEventTypes.includes(
                        eventType as SupportedWebhookEventType,
                      ),
                    )
                    .map((eventType) => formatEventType(eventType))
                    .join(", ")}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-white/40">
                  {new Date(webhook.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {webhooks.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-12 text-center text-sm text-white/40"
                >
                  No webhooks configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
