"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import {
  Forward,
  Inbox,
  Mail,
  Paperclip,
  Route,
  Settings2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

interface InboundDomain {
  id: string;
  name: string;
  status: "active" | "pending";
  createdAt: string;
  receivingEnabled: boolean;
  demo?: boolean;
}

export interface ReceivingRouteItem {
  id: string;
  domain_id: string;
  domain: string;
  type: "exact" | "alias" | "catch_all";
  local_part: string | null;
  target_local_part: string;
  target_address: string;
  demo?: boolean;
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
  demo?: boolean;
}

export type ReceivedRouteDecision = {
  recipient: string;
  status: "exact" | "alias" | "catch_all" | "unrouteable";
  domainId?: string;
  routeId?: string;
  routeType?: "exact" | "alias" | "catch_all";
  localPart?: string;
  targetAddress?: string;
};

export interface ReceivedEmailItem {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html?: string | null;
  text?: string | null;
  status: string;
  preview: string | null;
  route_decisions: ReceivedRouteDecision[];
  reply_match_status: string;
  thread_id: string | null;
  reply_to_email_id: string | null;
  contact_id: string | null;
  attachment_count: number;
  created_at: string;
  demo?: boolean;
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

const demoDomains: InboundDomain[] = [
  {
    id: "demo-domain-inbound-opliora",
    name: "inbound.opliora.com",
    status: "active",
    createdAt: "2026-06-08T06:10:00.000Z",
    receivingEnabled: true,
    demo: true,
  },
  {
    id: "demo-domain-support-namuh",
    name: "support.namuh.co",
    status: "active",
    createdAt: "2026-06-07T21:35:00.000Z",
    receivingEnabled: true,
    demo: true,
  },
];

const demoRoutes: ReceivingRouteItem[] = [
  {
    id: "demo-route-catch-all",
    domain_id: "demo-domain-inbound-opliora",
    domain: "inbound.opliora.com",
    type: "catch_all",
    local_part: null,
    target_local_part: "inbox",
    target_address: "inbox@inbound.opliora.com",
    demo: true,
  },
  {
    id: "demo-route-support",
    domain_id: "demo-domain-support-namuh",
    domain: "support.namuh.co",
    type: "exact",
    local_part: "help",
    target_local_part: "support",
    target_address: "support@support.namuh.co",
    demo: true,
  },
];

const demoForwardingRules: ForwardingRuleItem[] = [
  {
    id: "demo-forwarding-ops",
    domain_id: "demo-domain-inbound-opliora",
    domain: "inbound.opliora.com",
    route_id: "demo-route-catch-all",
    route_target_address: "inbox@inbound.opliora.com",
    destinations: ["ops@opliora.com", "founders@opliora.com"],
    status: "active",
    invalid_reason: null,
    last_attempt: {
      id: "demo-forwarding-attempt-1",
      status: "queued",
      reason: "forwarding_rule_active",
      received_email_id: "demo-received-1",
      forwarded_email_id: "demo-forwarded-1",
      forwarded_email_status: "queued",
      error_message: null,
      created_at: "2026-06-08T08:18:00.000Z",
    },
    demo: true,
  },
];

const demoReceivedEmails: ReceivedEmailItem[] = [
  {
    id: "demo-received-1",
    from: "maya@customer.example",
    to: ["hello@inbound.opliora.com"],
    subject: "Can you confirm our onboarding window?",
    html: "<p>We are ready to start the workspace migration next week.</p><p>Could you confirm the DNS and forwarding path before Friday?</p>",
    text: "We are ready to start the workspace migration next week. Could you confirm the DNS and forwarding path before Friday?",
    status: "received",
    preview:
      "We are ready to start the workspace migration next week. Could you confirm the DNS and forwarding path before Friday?",
    route_decisions: [
      {
        recipient: "hello@inbound.opliora.com",
        status: "catch_all",
        routeId: "demo-route-catch-all",
        routeType: "catch_all",
        targetAddress: "inbox@inbound.opliora.com",
      },
    ],
    reply_match_status: "unmatched",
    thread_id: null,
    reply_to_email_id: null,
    contact_id: null,
    attachment_count: 1,
    created_at: "2026-06-08T08:18:00.000Z",
    demo: true,
  },
  {
    id: "demo-received-2",
    from: "alerts@aws.amazon.com",
    to: ["help@support.namuh.co"],
    subject: "SES receipt rule notification",
    html: null,
    text: "Receipt rule processed the inbound message and stored the raw MIME object in the configured bucket.",
    status: "received",
    preview:
      "Receipt rule processed the inbound message and stored the raw MIME object in the configured bucket.",
    route_decisions: [
      {
        recipient: "help@support.namuh.co",
        status: "exact",
        routeId: "demo-route-support",
        routeType: "exact",
        targetAddress: "support@support.namuh.co",
      },
    ],
    reply_match_status: "unmatched",
    thread_id: null,
    reply_to_email_id: null,
    contact_id: null,
    attachment_count: 0,
    created_at: "2026-06-08T06:42:00.000Z",
    demo: true,
  },
  {
    id: "demo-received-3",
    from: "alex@partner.example",
    to: ["reply+demo-thread@inbound.opliora.com"],
    subject: "Re: launch checklist",
    html: "<p>Looks good. We updated the launch copy and sent the test cases back over for review.</p>",
    text: "Looks good. We updated the launch copy and sent the test cases back over for review.",
    status: "received",
    preview:
      "Looks good. We updated the launch copy and sent the test cases back over for review.",
    route_decisions: [
      {
        recipient: "reply+demo-thread@inbound.opliora.com",
        status: "catch_all",
        routeId: "demo-route-catch-all",
        routeType: "catch_all",
        targetAddress: "inbox@inbound.opliora.com",
      },
    ],
    reply_match_status: "matched",
    thread_id: "demo-thread-1",
    reply_to_email_id: "demo-outbound-1",
    contact_id: "demo-contact-1",
    attachment_count: 2,
    created_at: "2026-06-07T23:10:00.000Z",
    demo: true,
  },
];

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

function statusLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function routeDecisionLabel(email: ReceivedEmailItem): string {
  const decision = email.route_decisions[0];
  if (!decision) return "Unrouted";
  if (decision.status === "catch_all") return "Catch-all";
  return statusLabel(decision.status);
}

function routeDecisionVariant(
  email: ReceivedEmailItem,
): "success" | "error" | "warning" | "info" | "default" {
  const decision = email.route_decisions[0];
  if (!decision) return "default";
  if (decision.status === "unrouteable") return "error";
  if (decision.status === "catch_all") return "info";
  return "success";
}

function statusVariant(
  status: string,
): "success" | "error" | "warning" | "info" | "default" {
  if (status === "received" || status === "processed") return "success";
  if (status === "failed" || status === "unrouteable") return "error";
  if (status === "pending") return "warning";
  return "default";
}

function primaryRecipient(email: ReceivedEmailItem): string {
  return email.to[0] ?? "";
}

function countActiveDomains(domains: InboundDomain[]): number {
  return domains.filter(
    (domain) => domain.status === "active" && domain.receivingEnabled,
  ).length;
}

function countActiveForwardingRules(rules: ForwardingRuleItem[]): number {
  return rules.filter((rule) => rule.status === "active").length;
}

export function ReceivingList({
  domains,
  routes: initialRoutes,
  forwardingRules: initialForwardingRules,
  receivedEmails,
  useDemoData = false,
}: {
  domains: InboundDomain[];
  routes: ReceivingRouteItem[];
  forwardingRules: ForwardingRuleItem[];
  receivedEmails?: ReceivedEmailItem[];
  useDemoData?: boolean;
}) {
  const useDemoInbox = useDemoData && (receivedEmails?.length ?? 0) === 0;
  const useDemoConfig = useDemoData && domains.length === 0;
  const displayedDomains = useDemoConfig ? demoDomains : domains;
  const displayedReceivedEmails = useDemoInbox
    ? demoReceivedEmails
    : (receivedEmails ?? []);

  const [routes, setRoutes] = useState(
    useDemoConfig ? demoRoutes : initialRoutes,
  );
  const [forwardingRules, setForwardingRules] = useState(
    useDemoConfig ? demoForwardingRules : initialForwardingRules,
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
    const domain = displayedDomains.find((item) => item.id === domainId);
    if (domain?.demo) return;
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
    if (route.demo) return;
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
    if (rule.demo) return;
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

  const deleteRoute = async (route: ReceivingRouteItem) => {
    if (route.demo) return;
    setError(null);
    setBusyId(route.id);
    try {
      await apiRequest<{ id: string }>(`/api/receiving/routes/${route.id}`, {
        method: "DELETE",
      });
      setRoutes((current) => current.filter((item) => item.id !== route.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete route");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6 space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-accent">
              <Inbox aria-hidden className="h-4 w-4" />
              <span className="mono text-[11px] uppercase tracking-[0.12em]">
                Inbound mail
              </span>
            </div>
            <h2 className="text-lg font-medium text-fg">Received inbox</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-3">
              Messages stored after provider ingress, route matching, and tenant
              ownership checks.
            </p>
          </div>
          {useDemoInbox && <StatusBadge status="Demo data" variant="info" />}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Metric
            icon={<Mail aria-hidden className="h-4 w-4" />}
            label="Messages"
            value={displayedReceivedEmails.length.toLocaleString()}
          />
          <Metric
            icon={<Route aria-hidden className="h-4 w-4" />}
            label="Active domains"
            value={countActiveDomains(displayedDomains).toLocaleString()}
          />
          <Metric
            icon={<Forward aria-hidden className="h-4 w-4" />}
            label="Forwarding rules"
            value={countActiveForwardingRules(forwardingRules).toLocaleString()}
          />
        </div>

        <ReceivedInboxTable emails={displayedReceivedEmails} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-accent">
              <Settings2 aria-hidden className="h-4 w-4" />
              <span className="mono text-[11px] uppercase tracking-[0.12em]">
                Setup
              </span>
            </div>
            <h2 className="text-lg font-medium text-fg">
              Receiving configuration
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-3">
              Domains decide where inbound mail can land. Routes decide which
              local parts become stored messages and optional forwards.
            </p>
          </div>
          {useDemoConfig && <StatusBadge status="Demo config" variant="info" />}
        </div>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <ReceivingConfigTable
          busyId={busyId}
          domains={displayedDomains}
          forms={forms}
          forwardingForms={forwardingForms}
          forwardingRulesByRoute={forwardingRulesByRoute}
          routesByDomain={routesByDomain}
          createForwardingRule={createForwardingRule}
          createRoute={createRoute}
          deleteRoute={deleteRoute}
          updateForm={updateForm}
          updateForwardingForm={updateForwardingForm}
          updateForwardingRuleStatus={updateForwardingRuleStatus}
        />
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[70px] items-center justify-between rounded-md border border-line bg-bg-2 px-4 py-3">
      <div>
        <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
          {label}
        </p>
        <p className="mt-1 text-[22px] font-semibold text-fg">{value}</p>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-black text-fg-2">
        {icon}
      </div>
    </div>
  );
}

function ReceivedInboxTable({ emails }: { emails: ReceivedEmailItem[] }) {
  const [selectedEmail, setSelectedEmail] = useState<ReceivedEmailItem | null>(
    null,
  );

  if (emails.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-black px-6 py-14 text-center">
        <h3 className="text-[16px] font-medium text-fg">
          No received emails yet
        </h3>
        <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-6 text-fg-3">
          Inbound messages appear here after the ingester stores a tenant-scoped
          received email row.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-line bg-black">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="mono px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
                From
              </th>
              <th className="mono px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
                To
              </th>
              <th className="mono px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
                Route
              </th>
              <th className="mono px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
                Subject
              </th>
              <th className="mono px-4 py-3 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
                Received
              </th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr
                key={email.id}
                className="border-b border-line transition-colors last:border-b-0 hover:bg-bg-2"
              >
                <td className="px-4 py-3 text-[13.5px] text-fg">
                  <div className="flex min-w-[180px] items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                      {email.from.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">{email.from}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge
                          status={statusLabel(email.status)}
                          variant={statusVariant(email.status)}
                        />
                        {email.demo && (
                          <span className="text-[11px] text-fg-3">Demo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-fg-2">
                  <div className="max-w-[220px] truncate">
                    {primaryRecipient(email)}
                  </div>
                  {email.to.length > 1 && (
                    <div className="mt-1 text-[12px] text-fg-3">
                      +{email.to.length - 1} more
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <StatusBadge
                      status={routeDecisionLabel(email)}
                      variant={routeDecisionVariant(email)}
                    />
                    {email.reply_match_status === "matched" && (
                      <span className="text-[12px] text-fg-3">
                        Thread matched
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="max-w-[360px] text-left"
                    aria-label={`Open received email: ${email.subject}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <span className="block truncate text-[13.5px] text-fg">
                      {email.subject}
                    </span>
                    {email.preview && (
                      <span className="mt-1 block line-clamp-1 text-[12.5px] text-fg-3">
                        {email.preview}
                      </span>
                    )}
                    {email.attachment_count > 0 && (
                      <span className="mt-1 flex items-center gap-1 text-[12px] text-fg-3">
                        <Paperclip aria-hidden className="h-3.5 w-3.5" />
                        {email.attachment_count} attachment
                        {email.attachment_count === 1 ? "" : "s"}
                      </span>
                    )}
                  </button>
                </td>
                <td
                  className="mono whitespace-nowrap px-4 py-3 text-[12px] text-fg-3"
                  title={new Date(email.created_at).toLocaleString()}
                >
                  {formatRelativeTime(email.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReceivedEmailModal
        email={selectedEmail}
        onClose={() => setSelectedEmail(null)}
      />
    </>
  );
}

function ReceivedEmailModal({
  email,
  onClose,
}: {
  email: ReceivedEmailItem | null;
  onClose: () => void;
}) {
  const [view, setView] = useState<"html" | "text">("html");
  const hasHtml = Boolean(email?.html);
  const hasText = Boolean(email?.text);
  const activeView = hasHtml && view === "html" ? "html" : "text";

  return (
    <Modal
      open={Boolean(email)}
      onClose={onClose}
      title={email?.subject ?? "Received email"}
    >
      {email && (
        <div className="space-y-4">
          <div className="grid gap-2 text-[12.5px] text-fg-2 sm:grid-cols-2">
            <EmailMeta label="From" value={email.from} />
            <EmailMeta label="To" value={email.to.join(", ")} />
            <EmailMeta
              label="Received"
              value={new Date(email.created_at).toLocaleString()}
            />
            <EmailMeta label="Route" value={routeDecisionLabel(email)} />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasHtml}
              className={`rounded-md border px-3 py-1.5 text-[12px] transition-colors ${
                activeView === "html"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-fg-2 hover:bg-bg-2"
              } ${!hasHtml ? "cursor-not-allowed opacity-45" : ""}`}
              onClick={() => setView("html")}
            >
              HTML
            </button>
            <button
              type="button"
              disabled={!hasText}
              className={`rounded-md border px-3 py-1.5 text-[12px] transition-colors ${
                activeView === "text"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-fg-2 hover:bg-bg-2"
              } ${!hasText ? "cursor-not-allowed opacity-45" : ""}`}
              onClick={() => setView("text")}
            >
              Text
            </button>
          </div>

          <div className="max-h-[52vh] overflow-auto rounded-md border border-line bg-black">
            {activeView === "html" && email.html ? (
              <iframe
                title="Received email HTML"
                sandbox=""
                srcDoc={email.html}
                className="min-h-[360px] w-full border-0 bg-white"
              />
            ) : email.text ? (
              <pre className="whitespace-pre-wrap p-4 text-[13px] leading-6 text-fg">
                {email.text}
              </pre>
            ) : (
              <p className="p-4 text-[13px] text-fg-3">
                No message body was stored for this received email.
              </p>
            )}
          </div>

          {email.attachment_count > 0 && (
            <p className="flex items-center gap-2 text-[12.5px] text-fg-3">
              <Paperclip aria-hidden className="h-3.5 w-3.5" />
              {email.attachment_count} attachment
              {email.attachment_count === 1 ? "" : "s"} stored
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function EmailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-bg-2 px-3 py-2">
      <div className="mono text-[10px] uppercase tracking-[0.12em] text-fg-3">
        {label}
      </div>
      <div className="mt-1 truncate text-fg">{value}</div>
    </div>
  );
}

function ReceivingConfigTable({
  busyId,
  domains,
  forms,
  forwardingForms,
  forwardingRulesByRoute,
  routesByDomain,
  createForwardingRule,
  createRoute,
  deleteRoute,
  updateForm,
  updateForwardingForm,
  updateForwardingRuleStatus,
}: {
  busyId: string | null;
  domains: InboundDomain[];
  forms: Record<string, RouteFormState>;
  forwardingForms: Record<string, ForwardingFormState>;
  forwardingRulesByRoute: Map<string, ForwardingRuleItem>;
  routesByDomain: Map<string, ReceivingRouteItem[]>;
  createForwardingRule: (route: ReceivingRouteItem) => Promise<void>;
  createRoute: (domainId: string) => Promise<void>;
  deleteRoute: (route: ReceivingRouteItem) => Promise<void>;
  updateForm: (
    domainId: string,
    updater: (form: RouteFormState) => RouteFormState,
  ) => void;
  updateForwardingForm: (
    routeId: string,
    updater: (form: ForwardingFormState) => ForwardingFormState,
  ) => void;
  updateForwardingRuleStatus: (
    rule: ForwardingRuleItem,
    status: "active" | "disabled",
  ) => Promise<void>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-black">
      <table className="min-w-full divide-y divide-line">
        <thead>
          <tr>
            <th className="mono px-6 py-4 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
              Domain
            </th>
            <th className="mono px-6 py-4 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
              Status
            </th>
            <th className="mono px-6 py-4 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
              Routes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {domains.map((domain) => {
            const domainRoutes = routesByDomain.get(domain.id) ?? [];
            const form = forms[domain.id] ?? defaultForm;
            const ready = domain.status === "active" && domain.receivingEnabled;
            const disabled = !ready || domain.demo;
            return (
              <tr key={domain.id} className="align-top hover:bg-bg-2">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-fg">
                  <div className="flex items-center gap-2">
                    <span>{domain.name}</span>
                    {domain.demo && (
                      <span className="text-[11px] text-fg-3">Demo</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-fg-3">
                    Added {new Date(domain.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <StatusBadge
                    status={domain.status === "active" ? "active" : "pending"}
                  />
                  <div className="mt-2 text-xs text-fg-3">
                    Receiving {domain.receivingEnabled ? "enabled" : "disabled"}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="space-y-2">
                    {domainRoutes.map((route) => (
                      <RouteRow
                        key={route.id}
                        busyId={busyId}
                        forwardingForm={
                          forwardingForms[route.id] ?? defaultForwardingForm
                        }
                        forwardingRule={forwardingRulesByRoute.get(route.id)}
                        route={route}
                        createForwardingRule={createForwardingRule}
                        deleteRoute={deleteRoute}
                        updateForwardingForm={updateForwardingForm}
                        updateForwardingRuleStatus={updateForwardingRuleStatus}
                      />
                    ))}
                    {domainRoutes.length === 0 && (
                      <p className="text-xs text-fg-3">No routes configured.</p>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-[140px_1fr_1fr_auto]">
                    <select
                      aria-label={`Route type for ${domain.name}`}
                      className="rounded-md border border-line bg-black px-2 py-2 text-xs text-fg disabled:opacity-50"
                      value={form.type}
                      disabled={disabled}
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
                      className="rounded-md border border-line bg-black px-2 py-2 text-xs text-fg disabled:opacity-50"
                      placeholder="local part"
                      value={form.localPart}
                      disabled={disabled || form.type === "catch_all"}
                      onChange={(event) =>
                        updateForm(domain.id, (current) => ({
                          ...current,
                          localPart: event.target.value,
                        }))
                      }
                    />
                    <input
                      className="rounded-md border border-line bg-black px-2 py-2 text-xs text-fg disabled:opacity-50"
                      placeholder={
                        form.type === "exact"
                          ? "target (optional)"
                          : "target local part"
                      }
                      value={form.targetLocalPart}
                      disabled={disabled}
                      onChange={(event) =>
                        updateForm(domain.id, (current) => ({
                          ...current,
                          targetLocalPart: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded-md border border-line px-3 py-2 text-xs text-fg hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={disabled || busyId === domain.id}
                      onClick={() => void createRoute(domain.id)}
                    >
                      Add route
                    </button>
                  </div>
                  {!ready && (
                    <p className="mt-2 text-xs text-fg-3">
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
                className="px-6 py-12 text-center text-sm text-fg-3"
              >
                No inbound domains configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RouteRow({
  busyId,
  forwardingForm,
  forwardingRule,
  route,
  createForwardingRule,
  deleteRoute,
  updateForwardingForm,
  updateForwardingRuleStatus,
}: {
  busyId: string | null;
  forwardingForm: ForwardingFormState;
  forwardingRule?: ForwardingRuleItem;
  route: ReceivingRouteItem;
  createForwardingRule: (route: ReceivingRouteItem) => Promise<void>;
  deleteRoute: (route: ReceivingRouteItem) => Promise<void>;
  updateForwardingForm: (
    routeId: string,
    updater: (form: ForwardingFormState) => ForwardingFormState,
  ) => void;
  updateForwardingRuleStatus: (
    rule: ForwardingRuleItem,
    status: "active" | "disabled",
  ) => Promise<void>;
}) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-fg">
            {routeLabel(route)} -&gt; {route.target_address}
          </div>
          <div className="text-xs text-fg-3">{typeLabel(route.type)}</div>
        </div>
        <button
          type="button"
          className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
          disabled={busyId === route.id || route.demo}
          onClick={() => void deleteRoute(route)}
        >
          Delete
        </button>
      </div>

      {forwardingRule ? (
        <div className="mt-3 rounded border border-line bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-fg">
                Forwarding {forwardingRule.status}
              </div>
              <div className="text-xs text-fg-3">
                To {forwardingRule.destinations.join(", ")}
              </div>
            </div>
            <button
              type="button"
              className="rounded border border-line px-2 py-1 text-xs text-fg hover:bg-white/5 disabled:opacity-50"
              disabled={
                busyId === `forward-${forwardingRule.id}` ||
                forwardingRule.status === "invalid" ||
                forwardingRule.demo
              }
              onClick={() =>
                void updateForwardingRuleStatus(
                  forwardingRule,
                  forwardingRule.status === "active" ? "disabled" : "active",
                )
              }
            >
              {forwardingRule.status === "active" ? "Disable" : "Enable"}
            </button>
          </div>
          {forwardingRule.invalid_reason && (
            <div className="mt-1 text-xs text-yellow-300">
              {forwardingRule.invalid_reason}
            </div>
          )}
          {forwardingRule.last_attempt && (
            <div className="mt-2 text-xs text-fg-3">
              Last forward:{" "}
              <span className="text-fg">
                {forwardingRule.last_attempt.status}
              </span>{" "}
              ({forwardingRule.last_attempt.reason})
              {forwardingRule.last_attempt.forwarded_email_status && (
                <>
                  {" "}
                  outbound {forwardingRule.last_attempt.forwarded_email_status}
                </>
              )}
              {forwardingRule.last_attempt.error_message && (
                <div className="text-red-300">
                  {forwardingRule.last_attempt.error_message}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px_auto]">
          <input
            aria-label={`Forwarding destinations for ${routeLabel(route)}`}
            className="rounded-md border border-line bg-black px-2 py-2 text-xs text-fg disabled:opacity-50"
            placeholder="forward@example.com, ops@example.com"
            value={forwardingForm.destinations}
            disabled={route.demo}
            onChange={(event) =>
              updateForwardingForm(route.id, (current) => ({
                ...current,
                destinations: event.target.value,
              }))
            }
          />
          <select
            aria-label={`Forwarding status for ${routeLabel(route)}`}
            className="rounded-md border border-line bg-black px-2 py-2 text-xs text-fg disabled:opacity-50"
            value={forwardingForm.status}
            disabled={route.demo}
            onChange={(event) =>
              updateForwardingForm(route.id, (current) => ({
                ...current,
                status: event.target.value as ForwardingFormState["status"],
              }))
            }
          >
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-2 text-xs text-fg hover:bg-white/5 disabled:opacity-50"
            disabled={busyId === `forward-${route.id}` || route.demo}
            onClick={() => void createForwardingRule(route)}
          >
            Add forwarding
          </button>
        </div>
      )}
    </div>
  );
}
