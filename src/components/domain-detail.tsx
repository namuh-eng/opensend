"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export interface DomainDetailData {
  id: string;
  name: string;
  status: string;
  region: string;
  createdAt: string;
  clickTracking: boolean;
  openTracking: boolean;
  trackingSubdomain: string | null;
  tls: string;
  sendingEnabled: boolean;
  receivingEnabled: boolean;
  records: Array<{
    type: string;
    name: string;
    value: string;
    status: string;
    ttl: string;
    priority?: number;
  }> | null;
  events: Array<{ type: string; timestamp: string }>;
}

interface DomainDetailProps {
  domain: DomainDetailData;
}

async function apiRequest(
  input: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
): Promise<Response> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let message = "Request failed";

    try {
      const data = (await response.json()) as {
        details?: string;
        error?: string;
      };
      message = data.details ?? data.error ?? message;
    } catch {
      // ignore non-JSON error bodies
    }

    throw new Error(message);
  }

  return response;
}

const REGION_DISPLAY: Record<string, string> = {
  "us-east-1": "North Virginia",
  "eu-west-1": "Ireland",
  "sa-east-1": "São Paulo",
  "ap-northeast-1": "Tokyo",
};

function getDomainStatusVariant(
  status: string,
): "success" | "error" | "warning" | "info" | "default" {
  switch (status) {
    case "verified":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "error";
    default:
      return "default";
  }
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatEventTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${month} ${day}, ${h}:${minutes} ${ampm}`;
}

function formatEventLabel(type: string): string {
  switch (type) {
    case "domain_added":
      return "Domain added";
    case "dns_verified":
      return "DNS verified";
    case "domain_verified":
      return "Domain verified";
    default:
      return formatStatusLabel(type);
  }
}

function EventIcon({ type }: { type: string }) {
  if (type === "domain_added") {
    return (
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4ade80"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    );
  }
  if (type === "dns_verified") {
    return (
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#4ade80"
        strokeWidth="1.5"
      >
        <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4ade80"
      strokeWidth="1.5"
    >
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  );
}

export function DomainDetail({ domain }: DomainDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"records" | "configuration">(
    "records",
  );
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const regionFriendly = REGION_DISPLAY[domain.region] || domain.region;
  const isVerified = domain.status === "verified";

  const handleVerify = useCallback(async () => {
    if (verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      await apiRequest(`/api/domains/${domain.id}/verify`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Failed to verify domain",
      );
    } finally {
      setVerifying(false);
    }
  }, [domain.id, verifying, router]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/domains/${domain.id}`, { method: "DELETE" });
      router.push("/domains");
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  }, [domain.id, deleting, router]);

  const handleRestart = useCallback(async () => {
    setActionsOpen(false);
    try {
      await apiRequest(`/api/domains/${domain.id}/restart`, { method: "POST" });
      router.refresh();
    } catch {
      // silently fail
    }
  }, [domain.id, router]);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-[13px] text-fg-2">
        <Link href="/domains" className="hover:text-fg transition-colors">
          Domains
        </Link>
        <span>/</span>
        <span className="text-fg">Domain</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            data-testid="domain-icon"
            className="w-16 h-16 rounded-xl bg-bg-3 border border-line flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4ade80"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] text-fg-2">Domain</p>
            <h1 className="text-[22px] font-semibold text-fg">{domain.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isVerified && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="px-3 py-2 rounded-md border border-line text-[13px] font-medium text-fg hover:bg-bg-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? "Verifying…" : "Verify DNS Records"}
            </button>
          )}
          {verifyError && (
            <span className="text-[12px] text-red-400" role="alert">
              {verifyError}
            </span>
          )}
          <button
            type="button"
            aria-label="API drawer"
            className="p-2 rounded-md border border-line text-fg-2 hover:text-fg hover:bg-bg-2 transition-colors"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
            </svg>
          </button>

          <div className="relative">
            <button
              type="button"
              aria-label="More actions"
              className="p-2 rounded-md border border-line text-fg-2 hover:text-fg hover:bg-bg-2 transition-colors"
              onClick={() => setActionsOpen(!actionsOpen)}
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-line bg-bg-card shadow-xl z-20 py-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-[13px] text-fg hover:bg-bg-2"
                  onClick={handleRestart}
                >
                  Restart
                </button>
                <Link
                  href="/docs"
                  className="block px-3 py-2 text-[13px] text-fg hover:bg-bg-2"
                  onClick={() => setActionsOpen(false)}
                >
                  Go to docs
                </Link>
                <div className="border-t border-line my-1" />
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-[13px] text-red-400 hover:bg-bg-2"
                  onClick={() => {
                    setActionsOpen(false);
                    handleDelete();
                  }}
                >
                  Delete domain
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-4 gap-x-8 gap-y-6 mb-8">
        <div>
          <p className="text-[11px] font-semibold text-fg-2 tracking-wider mb-1">
            CREATED
          </p>
          <p className="text-[14px] text-fg">
            {formatRelativeTime(domain.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-fg-2 tracking-wider mb-1">
            STATUS
          </p>
          <StatusBadge
            status={formatStatusLabel(domain.status)}
            variant={getDomainStatusVariant(domain.status)}
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-fg-2 tracking-wider mb-1">
            PROVIDER
          </p>
          <div className="flex items-center gap-1.5">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="#f48120"
            >
              <path d="M16.5 7.3l-1.2 4.5c-.1.3-.3.4-.6.3l-3.3-1.2-1.6 1.6c-.2.2-.4.2-.5.1l.4-3.5 4.5-4c.2-.2 0-.3-.1-.2L8 9.5l-3.3-1c-.4-.1-.4-.4.1-.6l12.8-4.9c.4-.1.7.1.6.6l-1.7 3.7z" />
            </svg>
            <span className="text-[14px] text-fg">Cloudflare</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-fg-2 tracking-wider mb-1">
            REGION
          </p>
          <p className="text-[14px] text-fg">
            {regionFriendly}{" "}
            <span className="text-fg-2">({domain.region})</span>
          </p>
        </div>
      </div>

      {/* Domain Events */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold text-fg-2 tracking-wider mb-4">
          DOMAIN EVENTS
        </p>

        {isVerified && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[rgba(74,222,128,0.08)] border border-accent/30 mb-6">
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4ade80"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M9 15l2 2 4-4" />
            </svg>
            <p className="text-[14px] text-accent">
              <strong>Domain verified:</strong> Your domain is ready to send
              emails.
            </p>
          </div>
        )}

        <div className="flex items-center justify-center gap-8 py-4">
          {domain.events.map((event, i) => (
            <div key={event.timestamp} className="flex items-center gap-8">
              {i > 0 && <div className="w-12 h-px bg-white/[0.14]" />}
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-bg-3 border border-line flex items-center justify-center">
                  <EventIcon type={event.type} />
                </div>
                <span className="text-[13px] text-fg font-medium">
                  {formatEventLabel(event.type)}
                </span>
                <span className="text-[11px] text-fg-2">
                  {formatEventTimestamp(event.timestamp)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-line mb-6">
        <div className="flex items-center gap-0">
          {(
            [
              { key: "records", label: "Records" },
              { key: "configuration", label: "Configuration" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-[#F0F0F0] text-fg"
                  : "border-transparent text-fg-2 hover:text-fg"
              }`}
              onClick={() => setActiveTab(tab.key)}
              data-state={activeTab === tab.key ? "active" : "inactive"}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "records" ? (
        <RecordsTab domain={domain} />
      ) : (
        <ConfigurationTab domain={domain} />
      )}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copy to clipboard"
      className="ml-1 p-0.5 text-fg-2 hover:text-fg transition-colors inline-flex items-center"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4ade80"
          strokeWidth="2"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

function DNSRecordTable({
  records,
}: {
  records: DomainDetailData["records"];
}) {
  const rows = records || [];
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-line">
          <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2">
            Type
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2">
            Name
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2">
            Content
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2">
            TTL
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2">
            Priority
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((record) => (
          <tr
            key={`${record.type}-${record.name}-${record.value.slice(0, 20)}`}
            className="border-b border-line last:border-b-0"
          >
            <td className="px-3 py-2 text-[14px] text-fg">{record.type}</td>
            <td className="px-3 py-2 font-mono text-[12px] text-fg">
              <span className="flex items-center gap-1">
                <span className="max-w-[180px] truncate">{record.name}</span>
                <CopyButton value={record.name} />
              </span>
            </td>
            <td className="px-3 py-2 font-mono text-[12px] text-fg max-w-[200px]">
              <span className="flex items-center gap-1">
                <span className="truncate">{record.value}</span>
                <CopyButton value={record.value} />
              </span>
            </td>
            <td className="px-3 py-2 text-[14px] text-fg-2">{record.ttl}</td>
            <td className="px-3 py-2 text-[14px] text-fg-2">
              {record.priority ?? "—"}
            </td>
            <td className="px-3 py-2">
              <StatusBadge
                status={formatStatusLabel(record.status)}
                variant={record.status === "verified" ? "success" : "warning"}
              />
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={6}
              className="px-3 py-8 text-center text-[14px] text-fg-2"
            >
              No DNS records
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function RecordsTab({ domain }: { domain: DomainDetailData }) {
  const router = useRouter();
  const [sendingEnabled, setSendingEnabled] = useState(domain.sendingEnabled);
  const [receivingEnabled, setReceivingEnabled] = useState(
    domain.receivingEnabled,
  );
  const [autoConfiguring, setAutoConfiguring] = useState(false);
  const [autoConfigureError, setAutoConfigureError] = useState<string | null>(
    null,
  );

  const handleToggle = useCallback(
    async (field: "sending_enabled" | "receiving_enabled", value: boolean) => {
      try {
        await apiRequest(`/api/domains/${domain.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        router.refresh();
      } catch {
        if (field === "sending_enabled") setSendingEnabled(!value);
        else setReceivingEnabled(!value);
      }
    },
    [domain.id, router],
  );

  const handleAutoConfigure = useCallback(async () => {
    if (autoConfiguring) return;
    setAutoConfiguring(true);
    setAutoConfigureError(null);
    try {
      await apiRequest(`/api/domains/${domain.id}/auto-configure`, {
        method: "POST",
      });
      router.refresh();
    } catch (err) {
      setAutoConfigureError(
        err instanceof Error ? err.message : "Failed to auto-configure DNS",
      );
    } finally {
      setAutoConfiguring(false);
    }
  }, [autoConfiguring, domain.id, router]);

  const records = domain.records || [];

  // Split records into sections
  const dkimRecords = records.filter(
    (r) =>
      r.name.includes("_domainkey") ||
      (r.type === "TXT" && r.value.startsWith("p=")),
  );

  const sendingRecords = records.filter(
    (r) =>
      (r.type === "MX" && r.value.includes("feedback-smtp")) ||
      (r.type === "TXT" && r.value.includes("v=spf1")),
  );

  const dmarcRecords = records.filter(
    (r) => r.type === "TXT" && r.name.startsWith("_dmarc."),
  );

  const trackingRecords = records.filter(
    (r) => r.type === "CNAME" && !r.name.includes("_domainkey"),
  );

  return (
    <div className="bg-bg-3 border border-line rounded-lg p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-semibold text-fg">DNS Records</h2>
          {autoConfigureError && (
            <p className="mt-2 text-[12px] text-red-400" role="alert">
              {autoConfigureError}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAutoConfigure}
          disabled={autoConfiguring}
          className="px-3 py-2 rounded-md border border-line text-[13px] font-medium text-fg hover:bg-bg-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {autoConfiguring ? "Configuring…" : "Auto configure"}
        </button>
      </div>

      {/* Section 1: Domain Verification (DKIM) */}
      <div className="mb-8">
        <h3 className="text-[14px] font-semibold text-fg mb-1">
          Domain Verification
        </h3>
        <p className="text-[13px] text-blue-400 mb-4">DKIM</p>
        <DNSRecordTable records={dkimRecords.length > 0 ? dkimRecords : null} />
      </div>

      {/* Section 2: Enable Sending (SPF) */}
      <div className="mb-8 border-t border-line pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-fg">Enable Sending</h3>
          <button
            type="button"
            role="switch"
            aria-checked={sendingEnabled}
            data-testid="sending-toggle"
            data-state={sendingEnabled ? "checked" : "unchecked"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sendingEnabled ? "bg-[#4ade80]" : "bg-white/20"
            }`}
            onClick={() => {
              const newVal = !sendingEnabled;
              setSendingEnabled(newVal);
              handleToggle("sending_enabled", newVal);
            }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                sendingEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <DNSRecordTable
          records={sendingRecords.length > 0 ? sendingRecords : null}
        />
      </div>

      {/* Section 3: DMARC guidance */}
      <div className="mb-8 border-t border-line pt-6">
        <h3 className="text-[14px] font-semibold text-fg mb-1">DMARC Policy</h3>
        <p className="text-[13px] text-fg-2 mb-4">
          Publish this starter TXT record so receivers can evaluate SPF and DKIM
          alignment before you enforce a stricter policy.
        </p>
        <DNSRecordTable
          records={dmarcRecords.length > 0 ? dmarcRecords : null}
        />
      </div>

      {/* Section 4: Tracking CNAME */}
      <div className="mb-8 border-t border-line pt-6">
        <h3 className="text-[14px] font-semibold text-fg mb-1">
          Tracking CNAME
        </h3>
        <p className="text-[13px] text-fg-2 mb-4">
          Point this CNAME at your OpenSend tracking endpoint to use branded
          click and open tracking URLs.
        </p>
        <DNSRecordTable
          records={trackingRecords.length > 0 ? trackingRecords : null}
        />
      </div>

      {/* Section 5: Enable Receiving */}
      <div className="border-t border-line pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold text-fg">
            Enable Receiving
          </h3>
          <button
            type="button"
            role="switch"
            aria-checked={receivingEnabled}
            data-testid="receiving-toggle"
            data-state={receivingEnabled ? "checked" : "unchecked"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              receivingEnabled ? "bg-[#4ade80]" : "bg-white/20"
            }`}
            onClick={() => {
              const newVal = !receivingEnabled;
              setReceivingEnabled(newVal);
              handleToggle("receiving_enabled", newVal);
            }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                receivingEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigurationTab({ domain }: { domain: DomainDetailData }) {
  const router = useRouter();
  const [clickTracking, setClickTracking] = useState(domain.clickTracking);
  const [openTracking, setOpenTracking] = useState(domain.openTracking);
  const [trackingSubdomain, setTrackingSubdomain] = useState(
    domain.trackingSubdomain ?? "",
  );
  const [savingTrackingSubdomain, setSavingTrackingSubdomain] = useState(false);
  const [trackingSubdomainError, setTrackingSubdomainError] = useState<
    string | null
  >(null);
  const [tls, setTls] = useState(domain.tls || "opportunistic");

  const handleToggle = useCallback(
    async (field: "click_tracking" | "open_tracking", value: boolean) => {
      try {
        await fetch(`/api/domains/${domain.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        router.refresh();
      } catch {
        if (field === "click_tracking") setClickTracking(!value);
        else setOpenTracking(!value);
      }
    },
    [domain.id, router],
  );

  const handleTlsChange = useCallback(
    async (value: string) => {
      const prev = tls;
      setTls(value);
      try {
        await apiRequest(`/api/domains/${domain.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tls: value }),
        });
        router.refresh();
      } catch {
        setTls(prev);
      }
    },
    [domain.id, tls, router],
  );

  const handleTrackingSubdomainSave = useCallback(async () => {
    if (savingTrackingSubdomain) return;
    const nextValue = trackingSubdomain.trim();
    const previousValue = domain.trackingSubdomain ?? "";
    setSavingTrackingSubdomain(true);
    setTrackingSubdomainError(null);
    try {
      await apiRequest(`/api/domains/${domain.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_subdomain: nextValue || null,
        }),
      });
      router.refresh();
    } catch (err) {
      setTrackingSubdomain(previousValue);
      setTrackingSubdomainError(
        err instanceof Error
          ? err.message
          : "Failed to update tracking subdomain",
      );
    } finally {
      setSavingTrackingSubdomain(false);
    }
  }, [
    domain.id,
    domain.trackingSubdomain,
    router,
    savingTrackingSubdomain,
    trackingSubdomain,
  ]);

  return (
    <div className="bg-bg-3 border border-line rounded-lg p-6">
      <h2 className="text-[18px] font-semibold text-fg mb-6">Configuration</h2>

      <div className="space-y-8">
        <div>
          <h3 className="text-[14px] font-semibold text-fg mb-2">
            Click Tracking
          </h3>
          <p className="text-[13px] text-fg-2 mb-3 max-w-[600px]">
            To track clicks, OpenSend rewrites links in your HTML email. When
            recipients open a link, they visit your OpenSend tracking endpoint
            and are immediately redirected to the destination URL.
          </p>
          <button
            type="button"
            role="switch"
            aria-label="Click Tracking"
            aria-checked={clickTracking}
            data-state={clickTracking ? "checked" : "unchecked"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              clickTracking ? "bg-[#4ade80]" : "bg-white/20"
            }`}
            onClick={() => {
              const newVal = !clickTracking;
              setClickTracking(newVal);
              handleToggle("click_tracking", newVal);
            }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                clickTracking ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-line pt-8">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[14px] font-semibold text-fg">Open Tracking</h3>
            <span className="text-[11px] text-fg-2 bg-white/10 px-2 py-0.5 rounded">
              Not Recommended
            </span>
          </div>
          <p className="text-[13px] text-fg-2 mb-3 max-w-[600px]">
            To track opens, OpenSend inserts a 1x1 transparent pixel at the end
            of your email. This is not recommended as it can negatively impact
            deliverability.
          </p>
          <button
            type="button"
            role="switch"
            aria-label="Open Tracking"
            aria-checked={openTracking}
            data-state={openTracking ? "checked" : "unchecked"}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              openTracking ? "bg-[#4ade80]" : "bg-white/20"
            }`}
            onClick={() => {
              const newVal = !openTracking;
              setOpenTracking(newVal);
              handleToggle("open_tracking", newVal);
            }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                openTracking ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-line pt-8">
          <h3 className="text-[14px] font-semibold text-fg mb-2">
            Custom Tracking Subdomain
          </h3>
          <p className="text-[13px] text-fg-2 mb-3 max-w-[600px]">
            Optional. Enter a single DNS label such as{" "}
            <span className="font-mono text-fg">links</span>. OpenSend will show
            a CNAME for{" "}
            <span className="font-mono text-fg">links.{domain.name}</span> in
            DNS Records so your tracking URLs can stay on your branded domain.
          </p>
          <div className="flex max-w-[420px] items-center gap-2">
            <input
              aria-label="Custom tracking subdomain"
              type="text"
              value={trackingSubdomain}
              onChange={(event) => setTrackingSubdomain(event.target.value)}
              placeholder="links"
              className="min-w-0 flex-1 px-3 py-2 bg-bg-3 border border-line rounded-lg text-fg text-[14px] placeholder:text-fg-4 focus:outline-none focus:border-line-3"
            />
            <button
              type="button"
              onClick={handleTrackingSubdomainSave}
              disabled={savingTrackingSubdomain}
              className="px-3 py-2 rounded-lg bg-white text-black text-[13px] font-medium hover:bg-white/[0.12] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingTrackingSubdomain ? "Saving…" : "Save"}
            </button>
          </div>
          {trackingSubdomainError && (
            <p className="mt-2 text-[12px] text-red-400" role="alert">
              {trackingSubdomainError}
            </p>
          )}
        </div>

        <div className="border-t border-line pt-8">
          <h3 className="text-[14px] font-semibold text-fg mb-2">TLS</h3>
          <p className="text-[13px] text-fg-2 mb-3 max-w-[600px]">
            Opportunistic TLS attempts a secure connection but falls back to
            unencrypted if unavailable. Enforced TLS requires a secure
            connection and rejects delivery if TLS is not supported.
          </p>
          <select
            data-testid="tls-select"
            value={tls}
            onChange={(e) => handleTlsChange(e.target.value)}
            className="appearance-none bg-bg-3 border border-line rounded-lg px-3 py-2 text-[14px] text-fg focus:outline-none focus:border-line-3 cursor-pointer min-w-[200px]"
          >
            <option value="opportunistic">Opportunistic</option>
            <option value="enforced">Enforced</option>
          </select>
        </div>
      </div>
    </div>
  );
}
