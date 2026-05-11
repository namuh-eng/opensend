"use client";

import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export interface WebhookDeliveryDetailData {
  id: string;
  status: string;
  attempt: number;
  statusCode: number | null;
  attemptedAt: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface WebhookDetailData {
  id: string;
  endpoint: string;
  events: string[];
  status: "enabled" | "disabled";
  createdAt: string;
  recentDeliveries: WebhookDeliveryDetailData[];
}

interface WebhookReplayResponse {
  replay_delivery?: {
    id?: string;
    status?: string;
  };
  error?: string;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function deliveryBadgeStatus(
  status: string,
): "success" | "error" | "warning" | "default" {
  if (status === "success") return "success";
  if (status === "pending") return "warning";
  if (status === "failed" || status === "dead_letter") return "error";
  return "default";
}

async function parseReplayResponse(response: Response) {
  try {
    return (await response.json()) as WebhookReplayResponse;
  } catch {
    return {} satisfies WebhookReplayResponse;
  }
}

export function WebhookDetail({ webhook }: { webhook: WebhookDetailData }) {
  const router = useRouter();
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const replayDelivery = useCallback(
    async (deliveryId: string) => {
      if (replayingId) return;
      setReplayingId(deliveryId);
      setFeedback(null);

      try {
        const response = await fetch(
          `/api/webhooks/${webhook.id}/deliveries/${deliveryId}/replay`,
          { method: "POST" },
        );
        const body = await parseReplayResponse(response);

        if (!response.ok) {
          throw new Error(body.error ?? "Failed to replay webhook delivery");
        }

        const replayId = body.replay_delivery?.id ?? "new delivery";
        const replayStatus = body.replay_delivery?.status ?? "pending";
        setFeedback({
          tone: "success",
          message: `Replay triggered as ${replayId} (${formatStatusLabel(
            replayStatus,
          )}).`,
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to replay webhook delivery",
        });
      } finally {
        setReplayingId(null);
      }
    },
    [replayingId, router, webhook.id],
  );

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-[13px] text-[#A1A4A5]">
        <Link
          href="/webhooks"
          className="transition-colors hover:text-[#F0F0F0]"
        >
          Webhooks
        </Link>
        <span>/</span>
        <span className="text-[#F0F0F0]">Endpoint</span>
      </div>

      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-[13px] text-[#A1A4A5]">Webhook endpoint</p>
          <h1 className="mt-1 break-all text-2xl font-semibold text-[#F0F0F0]">
            {webhook.endpoint}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/40">
            <StatusBadge
              status={webhook.status === "enabled" ? "active" : "failed"}
            />
            <span>Created {formatDateTime(webhook.createdAt)}</span>
          </div>
        </div>
      </div>

      <section className="mb-6 rounded-lg border border-white/5 bg-black p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-white/40">
          Subscribed events
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {webhook.events.map((event) => (
            <span
              key={event}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-[#F0F0F0]"
            >
              {event}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/5 bg-black">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-white/40">
              Recent deliveries
            </h2>
            <p className="mt-1 text-sm text-white/40">
              Replay any recent message to send the same event payload again.
            </p>
          </div>
        </div>

        {feedback && (
          <output
            className={`mx-6 mt-4 block rounded-md border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {feedback.message}
          </output>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/5">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                  ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                  Attempt
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                  Status code
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                  Attempted at
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                  Next retry
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-white/40">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {webhook.recentDeliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-[#F0F0F0]">
                    {delivery.id}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <StatusBadge
                      status={delivery.status}
                      variant={deliveryBadgeStatus(delivery.status)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-white/40">
                    {delivery.attempt}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-white/40">
                    {delivery.statusCode ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-white/40">
                    {formatDateTime(delivery.attemptedAt)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-white/40">
                    {formatDateTime(delivery.nextRetryAt)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <button
                      type="button"
                      className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-[#F0F0F0] transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={replayingId !== null}
                      onClick={() => void replayDelivery(delivery.id)}
                    >
                      {replayingId === delivery.id ? "Replaying…" : "Replay"}
                    </button>
                  </td>
                </tr>
              ))}
              {webhook.recentDeliveries.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-white/40"
                  >
                    No webhook deliveries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
