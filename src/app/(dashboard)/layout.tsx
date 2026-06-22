export const dynamic = "force-dynamic";

import { CommandPaletteProvider } from "@/components/dashboard-shell/command-palette";
import { Sidebar } from "@/components/dashboard-shell/sidebar";
import { TopBar } from "@/components/dashboard-shell/topbar";
import { auth } from "@/lib/auth";
import { isBillingEnabled } from "@/lib/billing";
import { headers } from "next/headers";
import Link from "next/link";

function initials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = (name || email || "").trim();
  if (!source) return "OS";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const billingEnabled = isBillingEnabled();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const user = session?.user;
  const userName = user?.name ?? user?.email ?? "You";
  const userEmail = user?.email ?? "";

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-screen overflow-x-hidden bg-bg">
        <Sidebar
          billingEnabled={billingEnabled}
          userName={userName}
          userEmail={userEmail}
          userInitials={initials(user?.name, user?.email)}
        />
        <main className="flex min-h-screen min-w-0 flex-1 flex-col">
          <TopBar />
          <div className="min-w-0 flex-1 px-6 py-6">{children}</div>
          <footer className="flex items-center justify-end gap-4 border-t border-line px-6 py-3">
            <a
              href="https://github.com/namuh-eng/opensend/issues/new?labels=feedback"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[13px] text-fg-3 transition-colors hover:text-fg"
            >
              Feedback
            </a>
            <a
              href="https://github.com/namuh-eng/opensend/issues"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[13px] text-fg-3 transition-colors hover:text-fg"
            >
              Help
            </a>
            <Link
              href="/docs"
              className="text-[13px] text-fg-3 transition-colors hover:text-fg"
            >
              Docs
            </Link>
          </footer>
        </main>
      </div>
    </CommandPaletteProvider>
  );
}
