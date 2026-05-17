"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { Icon } from "./icons";

type Crumb = { label: string; href?: string; mono?: boolean };

const ROUTE_LABELS: Record<string, string> = {
  emails: "Emails",
  sending: "Sending",
  receiving: "Receiving",
  broadcasts: "Broadcasts",
  automations: "Automations",
  templates: "Templates",
  domains: "Domains",
  audience: "Audience",
  contacts: "Contacts",
  segments: "Segments",
  topics: "Topics",
  webhooks: "Webhooks",
  "api-keys": "API Keys",
  metrics: "Metrics",
  logs: "Logs",
  "audit-log": "Audit log",
  settings: "Settings",
  billing: "Billing",
  members: "Members",
  integrations: "Integrations",
};

function isIdSegment(segment: string): boolean {
  if (segment.length > 16 && /^[a-z0-9-]+$/i.test(segment)) return true;
  if (/^[A-Za-z0-9]{20,}$/.test(segment)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(segment);
}

function buildCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Today" }];
  const crumbs: Crumb[] = [];
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    acc += `/${seg}`;
    const isLast = i === parts.length - 1;
    if (isIdSegment(seg)) {
      crumbs.push({ label: seg, mono: true });
      continue;
    }
    const label = ROUTE_LABELS[seg] ?? seg.replace(/-/g, " ");
    crumbs.push({ label, href: isLast ? undefined : acc });
  }
  return crumbs;
}

type TopBarProps = {
  action?: ReactNode;
  rightExtras?: ReactNode;
};

export function TopBar({ action, rightExtras }: TopBarProps) {
  const pathname = usePathname() ?? "/";
  const crumbs = buildCrumbs(pathname);

  return (
    <header
      className="sticky top-0 z-20 flex h-[52px] flex-none items-center justify-between border-b border-line px-6"
      style={{
        background: "rgba(10,10,12,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-1.5"
      >
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const text = (
            <span
              className={`truncate text-[13px] ${last ? "font-medium text-fg" : "text-fg-3"} ${
                c.mono ? "mono tracking-tight" : "tracking-tight"
              }`}
            >
              {c.label}
            </span>
          );
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && (
                <span className="inline-flex h-3 w-3 flex-none text-fg-4">
                  <Icon.chevR />
                </span>
              )}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="transition-colors hover:text-fg-2"
                >
                  {text}
                </Link>
              ) : (
                text
              )}
            </Fragment>
          );
        })}
      </nav>
      <div className="flex items-center gap-2">
        {rightExtras}
        {action}
      </div>
    </header>
  );
}
