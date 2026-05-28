"use client";

import { StatusBadge } from "@/components/status-badge";
import { useMemo, useState } from "react";

interface InboundDomain {
  id: string;
  name: string;
  status: "active" | "pending";
  createdAt: string;
  receivingEnabled: boolean;
}

export interface ReceivingRouteItem {
  id: string;
  domain_id: string;
  domain: string;
  type: "exact" | "alias" | "catch_all";
  local_part: string | null;
  target_local_part: string;
  target_address: string;
}

type RouteFormState = {
  type: "exact" | "alias" | "catch_all";
  localPart: string;
  targetLocalPart: string;
};

const defaultForm: RouteFormState = {
  type: "exact",
  localPart: "",
  targetLocalPart: "",
};

async function apiRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function routeLabel(route: ReceivingRouteItem): string {
  if (route.type === "catch_all") return `*@${route.domain}`;
  return `${route.local_part}@${route.domain}`;
}

function typeLabel(type: ReceivingRouteItem["type"]): string {
  if (type === "catch_all") return "Catch-all";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function ReceivingList({
  domains,
  routes: initialRoutes,
}: {
  domains: InboundDomain[];
  routes: ReceivingRouteItem[];
}) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [forms, setForms] = useState<Record<string, RouteFormState>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const routesByDomain = useMemo(() => {
    const map = new Map<string, ReceivingRouteItem[]>();
    for (const route of routes) {
      map.set(route.domain_id, [...(map.get(route.domain_id) ?? []), route]);
    }
    return map;
  }, [routes]);

  const updateForm = (
    domainId: string,
    updater: (form: RouteFormState) => RouteFormState,
  ) => {
    setForms((current) => ({
      ...current,
      [domainId]: updater(current[domainId] ?? defaultForm),
    }));
  };

  const createRoute = async (domainId: string) => {
    const form = forms[domainId] ?? defaultForm;
    setError(null);
    setBusyId(domainId);
    try {
      const created = await apiRequest<ReceivingRouteItem>(
        "/api/receiving/routes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain_id: domainId,
            type: form.type,
            local_part: form.type === "catch_all" ? null : form.localPart,
            target_local_part:
              form.targetLocalPart ||
              (form.type === "exact" ? form.localPart : form.targetLocalPart),
          }),
        },
      );
      setRoutes((current) => [created, ...current]);
      setForms((current) => ({ ...current, [domainId]: defaultForm }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create route");
    } finally {
      setBusyId(null);
    }
  };

  const deleteRoute = async (routeId: string) => {
    setError(null);
    setBusyId(routeId);
    try {
      await apiRequest<{ id: string }>(`/api/receiving/routes/${routeId}`, {
        method: "DELETE",
      });
      setRoutes((current) => current.filter((route) => route.id !== routeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete route");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <h2 className="text-lg font-medium text-fg">Inbound Domains</h2>
        <p className="mt-1 text-sm text-white/50">
          Routes are evaluated in this order: exact address, alias, catch-all,
          then unrouteable.
        </p>
        {error && (
          <p className="mt-2 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-white/5 bg-black">
        <table className="min-w-full divide-y divide-white/5">
          <thead>
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                Domain
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                Routes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {domains.map((domain) => {
              const domainRoutes = routesByDomain.get(domain.id) ?? [];
              const form = forms[domain.id] ?? defaultForm;
              const ready =
                domain.status === "active" && domain.receivingEnabled;
              return (
                <tr key={domain.id} className="align-top hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-fg">
                    <div>{domain.name}</div>
                    <div className="text-xs text-white/40">
                      Added {new Date(domain.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <StatusBadge
                      status={domain.status === "active" ? "active" : "pending"}
                    />
                    <div className="mt-2 text-xs text-white/40">
                      Receiving{" "}
                      {domain.receivingEnabled ? "enabled" : "disabled"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="space-y-2">
                      {domainRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2"
                        >
                          <div>
                            <div className="font-mono text-xs text-fg">
                              {routeLabel(route)} → {route.target_address}
                            </div>
                            <div className="text-xs text-white/40">
                              {typeLabel(route.type)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                            disabled={busyId === route.id}
                            onClick={() => void deleteRoute(route.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {domainRoutes.length === 0 && (
                        <p className="text-xs text-white/40">
                          No routes configured.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-[140px_1fr_1fr_auto]">
                      <select
                        aria-label={`Route type for ${domain.name}`}
                        className="rounded-md border border-white/10 bg-black px-2 py-2 text-xs text-fg"
                        value={form.type}
                        disabled={!ready}
                        onChange={(event) =>
                          updateForm(domain.id, (current) => ({
                            ...current,
                            type: event.target.value as RouteFormState["type"],
                          }))
                        }
                      >
                        <option value="exact">Exact</option>
                        <option value="alias">Alias</option>
                        <option value="catch_all">Catch-all</option>
                      </select>
                      <input
                        className="rounded-md border border-white/10 bg-black px-2 py-2 text-xs text-fg disabled:opacity-50"
                        placeholder="local part"
                        value={form.localPart}
                        disabled={!ready || form.type === "catch_all"}
                        onChange={(event) =>
                          updateForm(domain.id, (current) => ({
                            ...current,
                            localPart: event.target.value,
                          }))
                        }
                      />
                      <input
                        className="rounded-md border border-white/10 bg-black px-2 py-2 text-xs text-fg disabled:opacity-50"
                        placeholder={
                          form.type === "exact"
                            ? "target (optional)"
                            : "target local part"
                        }
                        value={form.targetLocalPart}
                        disabled={!ready}
                        onChange={(event) =>
                          updateForm(domain.id, (current) => ({
                            ...current,
                            targetLocalPart: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="rounded-md border border-white/10 px-3 py-2 text-xs text-fg hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!ready || busyId === domain.id}
                        onClick={() => void createRoute(domain.id)}
                      >
                        Add route
                      </button>
                    </div>
                    {!ready && (
                      <p className="mt-2 text-xs text-white/40">
                        Verify the domain and enable receiving before adding
                        routes.
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
            {domains.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-12 text-center text-sm text-white/40"
                >
                  No inbound domains configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
