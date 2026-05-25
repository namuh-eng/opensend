"use client";

import { StatusBadge } from "@/components/status-badge";
import { authClient } from "@/lib/auth-client";

export function TeamTab() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[14px] text-fg-2">
            View your team members and their access levels.
          </p>
          <p
            id="team-actions-unavailable"
            className="max-w-2xl text-[13px] text-fg-2"
          >
            Team invitations and role editing are not available in OpenSend yet.
            These controls are disabled until member management is ready.
          </p>
        </div>
        <button
          type="button"
          className="h-9 shrink-0 cursor-not-allowed rounded-md border border-line bg-white/[0.08] px-4 text-[13px] font-medium text-fg-2 opacity-70"
          disabled
          aria-describedby="team-actions-unavailable"
          title="Team invitations are not available yet."
        >
          Invite member
        </button>
      </div>

      <div className="border border-line rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-bg-2">
              <th className="px-4 py-3 text-left text-[11px] font-medium text-fg-2 tracking-wider uppercase">
                Member
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-fg-2 tracking-wider uppercase">
                Role
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-medium text-fg-2 tracking-wider uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-[13px] text-fg-2"
                >
                  Loading…
                </td>
              </tr>
            ) : user ? (
              <tr className="border-b border-line last:border-0 hover:bg-bg-2 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <span className="text-[14px] text-fg font-medium">
                      {user.name || user.email}
                    </span>
                    <span className="text-[12px] text-fg-2">{user.email}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-[13px] text-fg capitalize">Owner</span>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status="Active" variant="success" />
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    className="cursor-not-allowed text-[12px] text-fg-3 opacity-70"
                    disabled
                    aria-describedby="team-actions-unavailable"
                    aria-label="Edit member unavailable"
                    title="Team role editing is not available yet."
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-[13px] text-fg-2"
                >
                  Sign in to view team members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
