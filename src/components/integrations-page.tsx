"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type IntegrationConnectionView = {
  id: string;
  provider: "webhook";
  name: string;
  status: "connected" | "disconnected";
  scopes: string[];
  config: {
    webhook?: {
      endpointHost?: string;
      endpointPreview?: string;
      hasSigningSecret?: boolean;
    };
  };
  health: "unknown" | "healthy" | "unhealthy";
  lastHealthCheckAt: string | null;
  lastSyncAt: string | null;
  lastEventAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type IntegrationCatalogView = {
  provider: "webhook";
  name: string;
  description: string;
  status: "installed" | "uninstalled";
  connection: IntegrationConnectionView | null;
};

type ApiConnectionResponse = {
  data?: IntegrationConnectionView;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function statusClass(status: string) {
  if (
    status === "installed" ||
    status === "connected" ||
    status === "healthy"
  ) {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (status === "unhealthy") {
    return "border-red-400/30 bg-red-400/10 text-red-200";
  }
  return "border-white/10 bg-white/[0.04] text-fg-3";
}

function Pill({ value }: { value: string }) {
  return (
    <span
      className={`mono inline-flex rounded-full border px-2 py-1 text-[11px] ${statusClass(value)}`}
    >
      {value}
    </span>
  );
}

async function readConnectionResponse(response: Response) {
  const body = (await response
    .json()
    .catch(() => ({}))) as ApiConnectionResponse;
  if (!response.ok) {
    throw new Error(body.error ?? "Integration request failed");
  }
  return body.data;
}

export function IntegrationsPage({
  catalog,
}: {
  catalog: IntegrationCatalogView[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const webhook = catalog.find((item) => item.provider === "webhook");
  const connection = webhook?.connection ?? null;

  function run(action: () => Promise<string>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        setMessage(result);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Integration failed");
      }
    });
  }

  function connect(formData: FormData) {
    run(async () => {
      const response = await fetch("/api/integrations/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          webhook_url: String(formData.get("webhook_url") ?? ""),
          signing_secret:
            String(formData.get("signing_secret") ?? "").trim() || null,
        }),
      });
      await readConnectionResponse(response);
      return "Webhook connector installed.";
    });
  }

  function update(formData: FormData) {
    if (!connection) return;
    run(async () => {
      const webhookUrl = String(formData.get("webhook_url") ?? "").trim();
      const signingSecret = String(formData.get("signing_secret") ?? "").trim();
      const payload: {
        name: string;
        webhook_url?: string;
        signing_secret?: string;
      } = { name: String(formData.get("name") ?? "") };
      if (webhookUrl) payload.webhook_url = webhookUrl;
      if (signingSecret) payload.signing_secret = signingSecret;
      const response = await fetch(
        `/api/integrations/connections/${connection.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      await readConnectionResponse(response);
      return "Webhook connector configuration updated.";
    });
  }

  function disconnect() {
    if (!connection) return;
    run(async () => {
      const response = await fetch(
        `/api/integrations/connections/${connection.id}`,
        {
          method: "DELETE",
        },
      );
      await readConnectionResponse(response);
      return "Webhook connector disconnected.";
    });
  }

  function sendTestEvent() {
    if (!connection) return;
    run(async () => {
      const response = await fetch(
        `/api/integrations/connections/${connection.id}/test`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        delivery?: { status?: number };
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to send test event");
      }
      return `Test event sent${body.delivery?.status ? ` (${body.delivery.status})` : ""}.`;
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <p className="mono text-xs uppercase tracking-[0.16em] text-fg-4">
          Integrations
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-fg">
          App integrations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-2">
          Connect OpenSend to the shipped webhook/Zapier-style outbound
          connector. Credentials are encrypted at rest and never shown after
          save.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-fg">
                {webhook?.name ?? "Webhook / Zapier"}
              </h2>
              <Pill value={webhook?.status ?? "uninstalled"} />
              {connection && <Pill value={connection.health} />}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-fg-2">
              {webhook?.description ??
                "Send signed test events to an automation webhook."}
            </p>
            {connection && (
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-fg-4">Endpoint</dt>
                  <dd className="mono text-fg">
                    {connection.config.webhook?.endpointPreview ?? "Configured"}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-4">Last event</dt>
                  <dd className="text-fg">
                    {formatDate(connection.lastEventAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-4">Last health check</dt>
                  <dd className="text-fg">
                    {formatDate(connection.lastHealthCheckAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-4">Signing secret</dt>
                  <dd className="text-fg">
                    {connection.config.webhook?.hasSigningSecret
                      ? "Stored encrypted"
                      : "Not configured"}
                  </dd>
                </div>
              </dl>
            )}
          </div>
          {connection && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={sendTestEvent}
                disabled={isPending || connection.status !== "connected"}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
              >
                Send test event
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={isPending}
                className="rounded-md border border-line px-3 py-2 text-sm text-fg-2 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        <form
          action={connection ? update : connect}
          className="mt-6 grid gap-4 rounded-lg border border-line bg-white/[0.02] p-4"
        >
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-fg">Name</span>
            <input
              name="name"
              defaultValue={connection?.name ?? "Webhook connector"}
              className="rounded-md border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-fg">
              Webhook URL {connection ? "(leave blank to keep current)" : ""}
            </span>
            <input
              name="webhook_url"
              type="url"
              required={!connection}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              className="rounded-md border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-fg">
              Signing secret {connection ? "(leave blank to keep current)" : ""}
            </span>
            <input
              name="signing_secret"
              type="password"
              placeholder="Optional shared secret"
              className="rounded-md border border-line bg-bg px-3 py-2 text-fg"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="w-fit rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {connection ? "Save configuration" : "Install connector"}
          </button>
        </form>
      </section>
    </div>
  );
}
