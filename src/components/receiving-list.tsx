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

export interface ForwardingRuleItem {
  id: string;
  domain_id: string;
  domain: string;
  route_id: string;
  route_target_address: string;
  destinations: string[];
  status: "active" | "disabled" | "invalid";
  invalid_reason: string | null;
  last_attempt: {
    id: string;
    status: "queued" | "skipped" | "failed";
    reason: string;
    received_email_id: string;
    forwarded_email_id: string | null;
    forwarded_email_status: string | null;
    error_message: string | null;
    created_at: string;
  } | null;
}

type RouteFormState = {
  type: "exact" | "alias" | "catch_all";
  localPart: string;
  targetLocalPart: string;
};

type ForwardingFormState = {
  destinations: string;
  status: "active" | "disabled";
};

const defaultForm: RouteFormState = {
  type: "exact",
  localPart: "",
  targetLocalPart: "",
};

const defaultForwardingForm: ForwardingFormState = {
  destinations: "",
  status: "active",
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
  forwardingRules: initialForwardingRules,
}: {
  domains: InboundDomain[];
  routes: ReceivingRouteItem[];
  forwardingRules: ForwardingRuleItem[];
}) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [forwardingRules, setForwardingRules] = useState(
    initialForwardingRules,
  );
  const [forms, setForms] = useState<Record<string, RouteFormState>>({});
  const [forwardingForms, setForwardingForms] = useState<
    Record<string, ForwardingFormState>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const routesByDomain = useMemo(() => {
    const map = new Map<string, ReceivingRouteItem[]>();
    for (const route of routes) {
      map.set(route.domain_id, [...(map.get(route.domain_id) ?? []), route]);
    }
    return map;
  }, [routes]);

  const forwardingRulesByRoute = useMemo(() => {
    const map = new Map<string, ForwardingRuleItem>();
    for (const rule of forwardingRules) {
      map.set(rule.route_id, rule);
    }
    return map;
  }, [forwardingRules]);

  const updateForm = (
    domainId: string,
    updater: (form: RouteFormState) => RouteFormState,
  ) => {
    setForms((current) => ({
      ...current,
      [domainId]: updater(current[domainId] ?? defaultForm),
    }));
  };

  const updateForwardingForm = (
    routeId: string,
    updater: (form: ForwardingFormState) => ForwardingFormState,
  ) => {
    setForwardingForms((current) => ({
      ...current,
      [routeId]: updater(current[routeId] ?? defaultForwardingForm),
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

  const createForwardingRule = async (route: ReceivingRouteItem) => {
    const form = forwardingForms[route.id] ?? defaultForwardingForm;
    const destinations = form.destinations
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    setError(null);
    setBusyId(`forward-${route.id}`);
    try {
      const created = await apiRequest<ForwardingRuleItem>(
        "/api/receiving/forwarding-rules",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            route_id: route.id,
            destinations,
            status: form.status,
          }),
        },
      );
      setForwardingRules((current) => [created, ...current]);
      setForwardingForms((current) => ({
        ...current,
        [route.id]: defaultForwardingForm,
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create forwarding rule",
      );
    } finally {
      setBusyId(null);
    }
  };

  const updateForwardingRuleStatus = async (
    rule: ForwardingRuleItem,
    status: "active" | "disabled",
  ) => {
    setError(null);
    setBusyId(`forward-${rule.id}`);
    try {
      const updated = await apiRequest<ForwardingRuleItem>(
        `/api/receiving/forwarding-rules/${rule.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      setForwardingRules((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update forwarding rule",
      );
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
                          className="rounded-md border border-white/10 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
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
                          {(() => {
                            const forwardingRule = forwardingRulesByRoute.get(
                              route.id,
                            );
                            const forwardingForm =
                              forwardingForms[route.id] ??
                              defaultForwardingForm;
                            if (forwardingRule) {
                              return (
                                <div className="mt-3 rounded border border-white/5 bg-white/[0.02] p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="text-xs font-medium text-fg">
                                        Forwarding {forwardingRule.status}
                                      </div>
                                      <div className="text-xs text-white/40">
                                        To{" "}
                                        {forwardingRule.destinations.join(", ")}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className="rounded border border-white/10 px-2 py-1 text-xs text-fg hover:bg-white/5 disabled:opacity-50"
                                      disabled={
                                        busyId ===
                                          `forward-${forwardingRule.id}` ||
                                        forwardingRule.status === "invalid"
                                      }
                                      onClick={() =>
                                        void updateForwardingRuleStatus(
                                          forwardingRule,
                                          forwardingRule.status === "active"
                                            ? "disabled"
                                            : "active",
                                        )
                                      }
                                    >
                                      {forwardingRule.status === "active"
                                        ? "Disable"
                                        : "Enable"}
                                    </button>
                                  </div>
                                  {forwardingRule.invalid_reason && (
                                    <div className="mt-1 text-xs text-yellow-300">
                                      {forwardingRule.invalid_reason}
                                    </div>
                                  )}
                                  {forwardingRule.last_attempt && (
                                    <div className="mt-2 text-xs text-white/50">
                                      Last forward:{" "}
                                      <span className="text-fg">
                                        {forwardingRule.last_attempt.status}
                                      </span>{" "}
                                      ({forwardingRule.last_attempt.reason})
                                      {forwardingRule.last_attempt
                                        .forwarded_email_status && (
                                        <>
                                          {" "}
                                          · outbound{" "}
                                          {
                                            forwardingRule.last_attempt
                                              .forwarded_email_status
                                          }
                                        </>
                                      )}
                                      {forwardingRule.last_attempt
                                        .error_message && (
                                        <div className="text-red-300">
                                          {
                                            forwardingRule.last_attempt
                                              .error_message
                                          }
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px_auto]">
                                <input
                                  aria-label={`Forwarding destinations for ${routeLabel(route)}`}
                                  className="rounded-md border border-white/10 bg-black px-2 py-2 text-xs text-fg"
                                  placeholder="forward@example.com, ops@example.com"
                                  value={forwardingForm.destinations}
                                  onChange={(event) =>
                                    updateForwardingForm(
                                      route.id,
                                      (current) => ({
                                        ...current,
                                        destinations: event.target.value,
                                      }),
                                    )
                                  }
                                />
                                <select
                                  aria-label={`Forwarding status for ${routeLabel(route)}`}
                                  className="rounded-md border border-white/10 bg-black px-2 py-2 text-xs text-fg"
                                  value={forwardingForm.status}
                                  onChange={(event) =>
                                    updateForwardingForm(
                                      route.id,
                                      (current) => ({
                                        ...current,
                                        status: event.target
                                          .value as ForwardingFormState["status"],
                                      }),
                                    )
                                  }
                                >
                                  <option value="active">Active</option>
                                  <option value="disabled">Disabled</option>
                                </select>
                                <button
                                  type="button"
                                  className="rounded-md border border-white/10 px-3 py-2 text-xs text-fg hover:bg-white/5 disabled:opacity-50"
                                  disabled={busyId === `forward-${route.id}`}
                                  onClick={() =>
                                    void createForwardingRule(route)
                                  }
                                >
                                  Add forwarding
                                </button>
                              </div>
                            );
                          })()}
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
