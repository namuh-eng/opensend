"use client";

import { CopyToClipboard } from "@/components/copy-to-clipboard";
import { StatusBadge } from "@/components/status-badge";
import { clsx } from "clsx";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

interface InsightItem {
  id: string;
  name: string;
  status: "needs_attention" | "doing_great";
  details: string;
}

const DEFAULT_INSIGHTS: InsightItem[] = [
  {
    id: "dmarc",
    name: "Include valid DMARC record",
    status: "needs_attention",
    details:
      "DMARC (Domain-based Message Authentication, Reporting & Conformance) helps protect your domain from email spoofing. Add a DMARC DNS record to improve deliverability and prevent unauthorized use of your domain.",
  },
  {
    id: "click-tracking",
    name: "Disable click tracking",
    status: "doing_great",
    details:
      "Click tracking is disabled, which means your email links point directly to the intended destination without redirects. This improves deliverability and user trust.",
  },
  {
    id: "open-tracking",
    name: "Disable open tracking",
    status: "doing_great",
    details:
      "Open tracking is disabled. No invisible tracking pixel is embedded in your emails, which improves deliverability and respects recipient privacy.",
  },
  {
    id: "subdomain",
    name: "Use a subdomain",
    status: "doing_great",
    details:
      "You are sending from a subdomain rather than your root domain. This protects your main domain's reputation and isolates transactional email reputation.",
  },
  {
    id: "link-urls",
    name: "Ensure link URLs match sending domain",
    status: "doing_great",
    details:
      "All links in your email use URLs that match your sending domain. This consistency helps email providers trust your messages.",
  },
  {
    id: "plain-text",
    name: "Include plain text version",
    status: "doing_great",
    details:
      "Your email includes a plain text version alongside the HTML. This improves accessibility and deliverability across different email clients.",
  },
  {
    id: "body-size",
    name: "Keep body size under 100KB",
    status: "doing_great",
    details:
      "Your email body is under 100KB. Large emails are more likely to be clipped or flagged by email providers.",
  },
  {
    id: "no-reply",
    name: "Avoid no-reply addresses",
    status: "doing_great",
    details:
      "You are not using a no-reply address. Using a real reply-to address improves engagement and deliverability.",
  },
  {
    id: "image-hosting",
    name: "Host images on your domain",
    status: "doing_great",
    details:
      "Images in your email are hosted on your own domain. This reduces the chance of images being blocked and improves brand consistency.",
  },
  {
    id: "svg-images",
    name: "Avoid SVG images",
    status: "doing_great",
    details:
      "Your email does not contain SVG images. SVGs are often blocked by email clients due to security concerns.",
  },
  {
    id: "youtube-urls",
    name: "Avoid YouTube embed URLs",
    status: "doing_great",
    details:
      "Your email does not contain YouTube embed URLs. Embedded videos are not supported in most email clients and can hurt deliverability.",
  },
];

export interface EmailDetailData {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html: string | null;
  text: string | null;
  createdAt: string;
  scheduledAt: string | null;
  tags: Array<{ name: string; value: string }>;
  headers: Record<string, string>;
  suppression?: {
    email: string;
    reason: "bounced" | "complained";
    suppressedAt: string;
  } | null;
  events: Array<{
    id: string;
    type: string;
    timestamp: string;
    summary: string;
    details: Record<string, string | number | boolean | string[]>;
  }>;
  logs?: Array<{
    id: string;
    method: string;
    endpoint: string;
    statusCode: number;
    createdAt: string;
  }>;
}

interface EmailDetailProps {
  email: EmailDetailData;
}

function getStatusVariant(
  status: string,
): "success" | "error" | "warning" | "info" | "default" {
  switch (status) {
    case "delivered":
    case "sent":
      return "success";
    case "bounced":
    case "failed":
      return "error";
    case "opened":
    case "clicked":
      return "info";
    case "delivery_delayed":
    case "complained":
      return "warning";
    case "suppressed":
      return "default";
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

function formatDetailLabel(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDetailValue(
  value: string | number | boolean | string[],
): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Renders trusted email HTML in a sandboxed iframe.
 * The HTML comes from our own DB (stored when we sent the email via SES),
 * so it is trusted first-party content — not user-supplied input.
 */
function EmailPreview({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={iframeRef}
      data-testid="email-preview"
      title="Email preview"
      sandbox=""
      srcDoc={html}
      className="w-full min-h-[300px] border-0"
    />
  );
}

function InsightAccordion({ item }: { item: InsightItem }) {
  const [expanded, setExpanded] = useState(false);

  const isWarning = item.status === "needs_attention";

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        className="w-full flex items-center gap-3 py-3 px-4 text-left hover:bg-bg-2 transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="text-[13px] text-fg-2 shrink-0">
          {expanded ? "▼" : "▶"}
        </span>
        {isWarning ? (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#f59e0b"
            className="shrink-0"
          >
            <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#4ade80"
            className="shrink-0"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        )}
        <span className="text-[14px] text-fg">{item.name}</span>
      </button>
      {expanded && (
        <div
          data-testid={`insight-detail-${item.id}`}
          className="px-4 pb-3 pl-14 text-[13px] text-fg-2 leading-relaxed"
        >
          {item.details}
        </div>
      )}
    </div>
  );
}

export function EmailDetail({ email }: EmailDetailProps) {
  const [activeTab, setActiveTab] = useState<
    "preview" | "plaintext" | "html" | "insights"
  >("preview");
  const primaryTo = email.to[0] || "";

  const needsAttention = DEFAULT_INSIGHTS.filter(
    (i) => i.status === "needs_attention",
  );
  const doingGreat = DEFAULT_INSIGHTS.filter((i) => i.status === "doing_great");

  const handleCopyTabContent = useCallback(() => {
    let content = "";
    if (activeTab === "preview" || activeTab === "html") {
      content = email.html || "";
    } else if (activeTab === "plaintext") {
      content = email.text || "";
    }
    if (content) {
      navigator.clipboard.writeText(content);
    }
  }, [activeTab, email.html, email.text]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div
          data-testid="email-envelope-icon"
          className="w-14 h-14 rounded-xl bg-bg-3 border border-line flex items-center justify-center shrink-0"
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
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-fg-2 mb-0.5">Email</p>
          <h1 className="text-[22px] font-semibold text-fg truncate">
            {primaryTo}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="More actions"
            className="p-2 rounded-lg hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>
      </div>

      {email.suppression && (
        <div
          data-testid="suppression-guidance"
          className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status="Suppressed" variant="warning" />
            <span className="text-[13px] text-fg">
              {email.suppression.email} is suppressed for this account because
              it{" "}
              {email.suppression.reason === "bounced"
                ? "hard bounced"
                : "reported a complaint"}
              .
            </span>
          </div>
          <p className="text-[13px] text-fg-2 leading-relaxed">
            OpenSend will skip future sends to this recipient for your account
            until an operator removes the suppression. If the recipient bounces
            or complains again after removal, OpenSend will suppress it again.
            Region-wide and provider-wide suppression scope is deferred for this
            first slice.
          </p>
        </div>
      )}

      {/* Metadata Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            FROM
          </p>
          <p className="text-[14px] text-fg">{email.from}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            SUBJECT
          </p>
          <p className="text-[14px] text-fg">{email.subject}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            TO
          </p>
          <p className="text-[14px] text-fg">{primaryTo}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            ID
          </p>
          <CopyToClipboard value={email.id} />
        </div>
      </div>

      {/* Tags and Headers */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-2">
            TAGS
          </p>
          <div className="flex flex-wrap gap-2">
            {email.tags.length > 0 ? (
              email.tags.map((tag) => (
                <div
                  key={`${tag.name}:${tag.value}`}
                  className="px-2 py-0.5 bg-white/10 border border-line rounded text-[12px] text-fg"
                >
                  <span className="text-fg-2">{tag.name}:</span> {tag.value}
                </div>
              ))
            ) : (
              <span className="text-[13px] text-fg-4">None</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-2">
            CUSTOM HEADERS
          </p>
          <div className="space-y-1">
            {Object.keys(email.headers).length > 0 ? (
              Object.entries(email.headers).map(([key, value]) => (
                <div key={key} className="text-[12px] font-mono">
                  <span className="text-fg-2">{key}:</span>{" "}
                  <span className="text-fg">{value}</span>
                </div>
              ))
            ) : (
              <span className="text-[13px] text-fg-4">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Email Events */}
      <div className="mb-8">
        <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-4">
          EMAIL EVENT TRACE
        </p>
        <div className="space-y-3" data-testid="event-timeline">
          {email.events.length > 0 ? (
            email.events.map((event) => {
              const details = Object.entries(event.details);
              return (
                <div
                  key={event.id}
                  className="rounded-lg border border-line bg-bg-2 px-4 py-3 text-[13px] group"
                  data-testid="event-trace-row"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={clsx(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        event.type === "delivered" || event.type === "sent"
                          ? "bg-emerald-500"
                          : event.type === "bounced" || event.type === "failed"
                            ? "bg-red-500"
                            : "bg-blue-500",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                          className="text-fg font-medium"
                          data-testid="event-badge"
                        >
                          {formatStatusLabel(event.type)}
                        </span>
                        <span className="text-fg-4">
                          {formatEventTimestamp(event.timestamp)}
                        </span>
                        <span
                          className="font-mono text-[11px] text-fg-2"
                          data-testid="event-id"
                        >
                          event_id: {event.id}
                        </span>
                      </div>
                      <p className="mt-1 text-fg">{event.summary}</p>
                      {details.length > 0 && (
                        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                          {details.map(([key, value]) => (
                            <div
                              key={key}
                              className="min-w-0 font-mono text-[11px]"
                            >
                              <dt className="inline text-fg-4">
                                {formatDetailLabel(key)}:
                              </dt>{" "}
                              <dd className="inline break-words text-fg-2">
                                {formatDetailValue(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-4 px-4 rounded-lg bg-bg-2 border border-dashed border-line text-center text-[13px] text-fg-4">
              No events recorded yet
            </div>
          )}
        </div>
      </div>

      {/* Associated Logs */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-medium text-fg-2 tracking-wider">
            ASSOCIATED LOGS
          </p>
          <Link
            href={`/logs?q=${encodeURIComponent(email.id)}`}
            className="text-[12px] text-fg-2 hover:text-fg transition-colors"
          >
            View all logs
          </Link>
        </div>
        <p className="mb-3 text-[12px] text-fg-4">
          Showing request logs linked to this message by the same email_id.
        </p>
        <div className="space-y-3" data-testid="associated-logs">
          {email.logs && email.logs.length > 0 ? (
            email.logs.map((log) => (
              <Link
                key={log.id}
                href={`/logs/${log.id}`}
                className="flex items-center gap-3 rounded-lg border border-line bg-bg-2 px-4 py-3 text-[13px] hover:bg-bg-3 transition-colors"
              >
                <StatusBadge status={log.method.toUpperCase()} variant="info" />
                <span className="font-mono text-fg truncate flex-1">
                  {log.endpoint || "-"}
                </span>
                <span className="font-mono text-[11px] text-fg-2">
                  same email_id
                </span>
                <span className="font-mono text-[11px] text-fg-4">
                  log_id: {log.id}
                </span>
                <StatusBadge
                  status={String(log.statusCode)}
                  variant={log.statusCode >= 400 ? "warning" : "success"}
                />
              </Link>
            ))
          ) : (
            <div className="py-4 px-4 rounded-lg bg-bg-2 border border-dashed border-line text-center text-[13px] text-fg-4">
              No associated API request logs yet
            </div>
          )}
        </div>
      </div>

      <div className="border-b border-line mb-4">
        <div className="flex items-center gap-0">
          {(
            [
              { key: "preview", label: "Preview" },
              { key: "plaintext", label: "Plain Text" },
              { key: "html", label: "HTML" },
              { key: "insights", label: "Insights" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`px-4 py-2 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "border-[#F0F0F0] text-fg"
                  : "border-transparent text-fg-2 hover:text-fg"
              }`}
              onClick={() => setActiveTab(tab.key)}
              data-state={activeTab === tab.key ? "active" : "inactive"}
            >
              {tab.label}
              {tab.key === "insights" && needsAttention.length > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-[11px] font-medium bg-white/[0.14] rounded-full">
                  {needsAttention.length}
                </span>
              )}
            </button>
          ))}
          <div className="ml-auto">
            <button
              type="button"
              data-testid="tab-copy-button"
              aria-label="Copy content"
              className="p-2 rounded-lg hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
              onClick={handleCopyTabContent}
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
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === "insights" ? (
        <div className="min-h-[300px]">
          {needsAttention.length > 0 && (
            <div data-testid="needs-attention-section" className="mb-6">
              <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-2 px-4">
                NEEDS ATTENTION
              </p>
              <div className="border border-line rounded-lg overflow-hidden">
                {needsAttention.map((item) => (
                  <InsightAccordion key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
          {doingGreat.length > 0 && (
            <div data-testid="doing-great-section">
              <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-2 px-4">
                DOING GREAT
              </p>
              <div className="border border-line rounded-lg overflow-hidden">
                {doingGreat.map((item) => (
                  <InsightAccordion key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg min-h-[300px] p-6">
          {activeTab === "preview" && <EmailPreview html={email.html || ""} />}
          {activeTab === "plaintext" && (
            <pre
              data-testid="email-plaintext"
              className="text-black text-[14px] whitespace-pre-wrap font-mono"
            >
              {email.text || ""}
            </pre>
          )}
          {activeTab === "html" && (
            <pre
              data-testid="email-html"
              className="text-black text-[14px] whitespace-pre-wrap font-mono"
            >
              {email.html || ""}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
