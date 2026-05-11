"use client";

import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

export interface EmailListItem {
  id: string;
  to: string[];
  lastEvent: string;
  subject: string;
  createdAt: string;
  sentAt?: string | null;
}

interface EmailsSendingDataTableProps {
  emails: EmailListItem[];
  emptyState?: "first-run" | "filtered";
}

export function getStatusVariant(
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
    case "processing":
      return "warning";
    default:
      return "default";
  }
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) {
    return `about ${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  }
  if (diffHr > 0) {
    return `about ${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  }
  if (diffMin > 0) {
    return `about ${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

export function EmailsSendingDataTable({
  emails,
  emptyState = "filtered",
}: EmailsSendingDataTableProps) {
  if (emails.length === 0) {
    if (emptyState === "first-run") {
      return <EmailsFirstRunEmptyState />;
    }

    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-[14px] font-medium text-[#F0F0F0]">
          No emails match your filters
        </p>
        <p className="max-w-[360px] text-[13px] leading-5 text-[#A1A4A5]">
          Adjust your search, status, or date filters to find sent emails.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[rgba(176,199,217,0.145)]">
          <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5] tracking-normal">
            To
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5] tracking-normal">
            Status
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5] tracking-normal">
            Subject
          </th>
          <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5] tracking-normal">
            Sent
          </th>
          <th className="w-10 px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {emails.map((email) => {
          const primaryTo = email.to[0] || "";
          return (
            <EmailRow key={email.id} email={email} primaryTo={primaryTo} />
          );
        })}
      </tbody>
    </table>
  );
}

function EmailsFirstRunEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="space-y-2">
        <h2 className="text-[18px] font-semibold text-[#F0F0F0]">
          No sent emails yet
        </h2>
        <p className="max-w-[420px] text-[14px] leading-6 text-[#A1A4A5]">
          Start sending emails to see insights and previews for every message.
        </p>
      </div>
      <Link
        href="/docs"
        className="inline-flex h-9 items-center justify-center rounded-[8px] border border-[rgba(176,199,217,0.18)] px-4 text-[13px] font-medium text-[#F0F0F0] transition-colors hover:bg-[rgba(176,199,217,0.1)]"
      >
        Go to docs
      </Link>
    </div>
  );
}

function EmailRow({
  email,
  primaryTo,
}: { email: EmailListItem; primaryTo: string }) {
  const displayedTimestamp = email.sentAt ?? email.createdAt;

  return (
    <tr className="border-b border-[rgba(176,199,217,0.145)] hover:bg-[rgba(24,25,28,0.5)] transition-colors">
      <td className="px-3 py-2 text-[14px] text-[#F0F0F0]">
        <div className="flex items-center gap-2">
          <div
            data-testid="email-avatar"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
            style={{ backgroundColor: getAvatarColor(primaryTo) }}
          >
            {primaryTo.charAt(0).toUpperCase()}
          </div>
          <Link
            href={`/emails/${email.id}`}
            className="text-[#F0F0F0] hover:underline"
          >
            {primaryTo}
          </Link>
        </div>
      </td>
      <td className="px-3 py-2">
        <StatusBadge
          status={formatStatusLabel(email.lastEvent)}
          variant={getStatusVariant(email.lastEvent)}
        />
      </td>
      <td className="px-3 py-2 text-[14px] text-[#F0F0F0]">{email.subject}</td>
      <td
        className="px-3 py-2 text-[14px] text-[#A1A4A5]"
        title={new Date(displayedTimestamp).toLocaleString()}
      >
        {formatRelativeTime(displayedTimestamp)}
      </td>
      <td className="w-10 px-3 py-2 relative">
        <RowActions />
      </td>
    </tr>
  );
}

function RowActions() {
  return (
    <button
      type="button"
      aria-label="More actions"
      className="p-1 rounded hover:bg-[rgba(176,199,217,0.145)] text-[#A1A4A5] hover:text-[#F0F0F0] transition-colors"
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
  );
}
