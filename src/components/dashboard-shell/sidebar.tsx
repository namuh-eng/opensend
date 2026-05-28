"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useCommandPalette } from "./command-palette";
import { Icon, type IconName } from "./icons";

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
  live?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type SidebarProps = {
  billingEnabled?: boolean;
  workspaceName?: string;
  workspaceTier?: string;
  userName?: string;
  userEmail?: string;
  userInitials?: string;
};

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/today", label: "Today", icon: "overview" }],
  },
  {
    label: "Send",
    items: [
      { href: "/emails", label: "Emails", icon: "emails" },
      { href: "/broadcasts", label: "Broadcasts", icon: "broadcasts" },
      { href: "/automations", label: "Automations", icon: "automations" },
      { href: "/templates", label: "Templates", icon: "templates" },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/domains", label: "Domains", icon: "domains" },
      { href: "/audience", label: "Audience", icon: "audience" },
      { href: "/suppressions", label: "Suppressions", icon: "suppressions" },
      { href: "/webhooks", label: "Webhooks", icon: "webhooks" },
      { href: "/api-keys", label: "API Keys", icon: "keys" },
    ],
  },
  {
    label: "Inspect",
    items: [
      { href: "/metrics", label: "Metrics", icon: "metrics" },
      { href: "/logs", label: "Logs", icon: "logs", live: true },
      { href: "/exports", label: "Exports", icon: "logs" },
      { href: "/audit-log", label: "Audit log", icon: "audit" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings/billing", label: "Billing", icon: "billing" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/settings") {
    return pathname === "/settings";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const IconCmp = Icon[item.icon];
  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors ${
        active ? "bg-accent-soft text-fg" : "text-fg-2 hover:bg-white/[0.03]"
      }`}
    >
      {active && (
        <span
          className="absolute -left-2 top-1.5 bottom-1.5 w-0.5 rounded bg-accent"
          style={{ boxShadow: "0 0 8px var(--accent)" }}
          aria-hidden
        />
      )}
      <span
        className={`inline-flex h-4 w-4 ${active ? "text-accent" : "text-fg-3"}`}
      >
        <IconCmp />
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="mono rounded bg-white/[0.04] px-1.5 py-px text-[10.5px] text-fg-3">
          {item.badge}
        </span>
      )}
      {item.live && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-accent"
          style={{
            boxShadow: "0 0 8px var(--accent)",
            animation: "shell-pulse 1.6s ease-in-out infinite",
          }}
          aria-hidden
        />
      )}
    </Link>
  );
}

function GroupBlock({
  pathname,
  group,
}: {
  pathname: string;
  group: NavGroup;
}) {
  return (
    <div className="mt-3.5">
      <div className="mono px-2 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-fg-4">
        {group.label}
      </div>
      <div className="flex flex-col gap-px">
        {group.items.map((it) => (
          <NavRow
            key={it.href}
            item={it}
            active={isItemActive(pathname, it.href)}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceSwitcher({
  name,
  tier,
}: {
  name: string;
  tier: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 border-b border-line px-3 py-3 text-left transition-colors hover:bg-white/[0.02]"
    >
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-accent text-[12px] font-semibold text-accent-ink">
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[13px] font-medium tracking-tight">
          {name}
        </span>
        <span className="mono text-[10.5px] text-fg-3">workspace · {tier}</span>
      </span>
      <span className="inline-flex h-3.5 w-3.5 text-fg-3">
        <Icon.chevD />
      </span>
    </button>
  );
}

function CommandSearch() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className="mx-3 mt-3 flex h-8 items-center gap-2 rounded-md border border-line-2 bg-white/[0.02] px-2.5 text-[13px] text-fg-3 transition-colors hover:bg-white/[0.04] hover:text-fg-2"
    >
      <span className="inline-flex h-3.5 w-3.5 text-fg-3">
        <Icon.search />
      </span>
      <span className="flex-1 text-left">Search or run command</span>
      <span className="kbd">⌘K</span>
    </button>
  );
}

function UserFooter({
  name,
  email,
  initials,
}: {
  name: string;
  email: string;
  initials: string;
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/auth");
      router.refresh();
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center gap-2.5 border-t border-line p-2.5"
    >
      <span
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{
          background: "linear-gradient(135deg, var(--violet), var(--pink))",
        }}
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-[12.5px] font-medium">{name}</span>
        <span className="mono truncate text-[10.5px] text-fg-3">{email}</span>
      </span>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-fg-3 transition-colors hover:bg-white/[0.04] hover:text-fg-2"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex h-3.5 w-3.5">
          <Icon.more />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-2 right-2 z-30 mb-1 overflow-hidden rounded-card border border-line-2 bg-bg-card shadow-2xl"
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[13px] text-fg-2 transition-colors hover:bg-white/[0.04] hover:text-fg"
          >
            <span className="inline-flex h-3.5 w-3.5 text-fg-3">
              <Icon.settings />
            </span>
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-[13px] text-fg-2 transition-colors hover:bg-white/[0.04] hover:text-fg disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  billingEnabled = true,
  workspaceName = "Opensend",
  workspaceTier = "pro",
  userName = "You",
  userEmail = "",
  userInitials = "OS",
}: SidebarProps): ReactNode {
  const pathname = usePathname() ?? "/";
  const groups = billingEnabled
    ? GROUPS
    : GROUPS.map((g) =>
        g.label === "Account"
          ? {
              ...g,
              items: g.items.filter((i) => i.href !== "/settings/billing"),
            }
          : g,
      );
  return (
    <aside className="sticky top-0 flex h-screen w-[248px] flex-none flex-col border-r border-line bg-bg">
      <WorkspaceSwitcher name={workspaceName} tier={workspaceTier} />
      <CommandSearch />
      <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => (
          <GroupBlock key={g.label} pathname={pathname} group={g} />
        ))}
      </nav>
      <UserFooter
        name={userName}
        email={userEmail || "—"}
        initials={userInitials}
      />
    </aside>
  );
}
