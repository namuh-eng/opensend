export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/sidebar";
import { isBillingEnabled } from "@/lib/billing";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const billingEnabled = isBillingEnabled();
  return (
    <div className="flex min-h-screen">
      <Sidebar billingEnabled={billingEnabled} />
      <main className="ml-[250px] flex min-h-screen flex-1 flex-col">
        <div className="flex-1 p-6">{children}</div>
        <footer className="flex items-center justify-end gap-4 border-t border-[rgba(176,199,217,0.145)] px-6 py-3">
          <a
            href="mailto:feedback@example.com?subject=OpenSend%20Feedback"
            className="text-[13px] text-[#A1A4A5] transition-colors hover:text-[#F0F0F0]"
          >
            Feedback
          </a>
          <a
            href="mailto:help@example.com?subject=OpenSend%20Help"
            className="text-[13px] text-[#A1A4A5] transition-colors hover:text-[#F0F0F0]"
          >
            Help
          </a>
          <Link
            href="/docs"
            className="text-[13px] text-[#A1A4A5] transition-colors hover:text-[#F0F0F0]"
          >
            Docs
          </Link>
        </footer>
      </main>
    </div>
  );
}
