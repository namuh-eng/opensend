"use client";

import { StatusBadge } from "@/components/status-badge";

interface InboundDomain {
  id: string;
  name: string;
  status: "active" | "pending";
  createdAt: string;
}

export function ReceivingList({ domains }: { domains: InboundDomain[] }) {
  return (
    <div className="mt-8">
      <h2 className="text-lg font-medium text-fg mb-4">Inbound Domains</h2>
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
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {domains.map((domain) => (
              <tr key={domain.id} className="hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-fg">
                  {domain.name}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <StatusBadge
                    status={domain.status === "active" ? "active" : "pending"}
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-white/40">
                  {new Date(domain.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
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
