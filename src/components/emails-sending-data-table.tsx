"use client";

import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
        <p className="text-[14px] font-medium text-fg">
          No emails match your filters
        </p>
        <p className="max-w-[360px] text-[13px] leading-5 text-fg-3">
          Adjust your search, status, or date filters to find sent emails.
        </p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-line">
          <th className="mono px-4 py-2.5 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
            To
          </th>
          <th className="mono px-4 py-2.5 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
            Status
          </th>
          <th className="mono px-4 py-2.5 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
            Subject
          </th>
          <th className="mono px-4 py-2.5 text-left text-[10.5px] uppercase tracking-[0.12em] text-fg-3">
            Sent
          </th>
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
        <h2 className="text-[18px] font-semibold text-fg">
          No sent emails yet
        </h2>
        <p className="max-w-[420px] text-[14px] leading-6 text-fg-3">
          Start sending emails to see insights and previews for every message.
        </p>
      </div>
      <Link href="/docs" className="btn btn-ghost btn-sm">
        Go to docs
      </Link>
    </div>
  );
}

function EmailRow({
  email,
  primaryTo,
}: { email: EmailListItem; primaryTo: string }) {
  const router = useRouter();
  const displayedTimestamp = email.sentAt ?? email.createdAt;
  const href = `/emails/${email.id}`;
  const openEmail = () => router.push(href);

  return (
    <tr
      className="group cursor-pointer border-b border-line transition-colors hover:bg-bg-2 focus-within:bg-bg-2"
      data-testid="email-row"
      onClick={openEmail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEmail();
        }
      }}
      tabIndex={0}
      title={`Open email ${email.subject}`}
    >
      <td className="px-4 py-3 text-[13.5px] text-fg">
        <div className="flex items-center gap-2.5">
          <div
            data-testid="email-avatar"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
            style={{ backgroundColor: getAvatarColor(primaryTo) }}
          >
            {primaryTo.charAt(0).toUpperCase()}
          </div>
          <span className="text-fg transition-colors group-hover:text-accent">
            {primaryTo}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge
          status={formatStatusLabel(email.lastEvent)}
          variant={getStatusVariant(email.lastEvent)}
        />
      </td>
      <td className="px-4 py-3 text-[13.5px]">
        <Link
          href={href}
          className="font-medium text-fg transition-colors hover:text-accent"
          onClick={(event) => event.stopPropagation()}
        >
          {email.subject}
        </Link>
      </td>
      <td
        className="mono px-4 py-3 text-[12px] text-fg-3"
        title={new Date(displayedTimestamp).toLocaleString()}
      >
        {formatRelativeTime(displayedTimestamp)}
      </td>
    </tr>
  );
}
