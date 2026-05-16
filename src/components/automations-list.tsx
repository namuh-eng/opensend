"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface AutomationListItem {
  id: string;
  name: string;
  status: string;
  trigger_event_name: string | null;
  step_count: number;
  last_run?: { status: string; created_at: string } | null;
  created_at: string;
  updated_at: string;
}

const AUTOMATION_STATUSES = ["draft", "enabled", "disabled"] as const;

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function AutomationsList() {
  const router = useRouter();
  const [automations, setAutomations] = useState<AutomationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const query = params.toString();
      const res = await fetch(`/api/automations${query ? `?${query}` : ""}`);
      if (!res.ok) {
        setAutomations([]);
        setTotal(0);
        setError("Failed to load automations.");
        return;
      }
      const data = await res.json();
      setAutomations(data.data ?? []);
      setTotal(data.total ?? data.data?.length ?? 0);
    } catch {
      setAutomations([]);
      setTotal(0);
      setError("Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(e.target as Node)
      ) {
        setActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(value), 300);
  };

  const handleDelete = async (item: AutomationListItem) => {
    setActionMenuId(null);
    try {
      await fetch(`/api/automations/${item.id}`, {
        method: "DELETE",
      });
      fetchAutomations();
    } catch {
      // ignore
    }
  };

  const handleToggleEnabled = async (item: AutomationListItem) => {
    setActionMenuId(null);
    const nextStatus = item.status === "enabled" ? "disabled" : "enabled";
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const res = await fetch(`/api/automations/${item.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.error ?? `Could not switch automation to ${nextStatus}.`,
        );
        return;
      }
      fetchAutomations();
    } catch {
      setError(`Could not switch automation to ${nextStatus}.`);
    }
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search..."
          className="flex-1 h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        <div className="relative" ref={statusRef}>
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            className="h-9 px-3 text-[13px] border border-line rounded-md text-fg-2 hover:text-fg hover:border-line-3 transition-colors flex items-center gap-1.5 min-w-[140px]"
          >
            <span>
              {statusFilter ? capitalize(statusFilter) : "All Statuses"}
            </span>
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="ml-auto"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {statusOpen ? (
            <div
              role="menu"
              className="absolute top-full left-0 mt-1 w-[180px] bg-bg-card border border-line rounded-md shadow-lg z-50 py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStatusFilter("");
                  setStatusOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/[0.08] transition-colors ${!statusFilter ? "text-fg" : "text-fg-2"}`}
              >
                All Statuses
              </button>
              {AUTOMATION_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  role="menuitem"
                  onClick={() => {
                    setStatusFilter(s);
                    setStatusOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/[0.08] transition-colors ${statusFilter === s ? "text-fg" : "text-fg-2"}`}
                >
                  {capitalize(s)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Link href="/automations/new" className="btn btn-primary">
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create automation
        </Link>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          Loading automations...
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <h3 className="text-[16px] font-semibold text-fg mb-2">
            No automations
          </h3>
          <p className="text-[14px] text-fg-2 text-center max-w-[420px] mb-6">
            Trigger an email when a custom event happens. Start with a linear
            flow: trigger → delay → send_email.
          </p>
          <button
            type="button"
            onClick={() => router.push("/automations/new")}
            className="btn btn-primary"
          >
            Create automation
          </button>
        </div>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Trigger event
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Steps
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Last run
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Updated
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {automations.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-line hover:bg-bg-2 transition-colors group"
                >
                  <td className="px-3 py-2 text-[14px] text-fg">
                    <Link
                      href={`/automations/${a.id}`}
                      className="hover:underline"
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {capitalize(a.status)}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {a.trigger_event_name ?? (
                      <span className="text-fg-4">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {a.step_count}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {a.last_run ? (
                      <span
                        title={new Date(a.last_run.created_at).toLocaleString()}
                      >
                        {capitalize(a.last_run.status)} ·{" "}
                        {formatRelativeTime(a.last_run.created_at)}
                      </span>
                    ) : (
                      <span className="text-fg-4">No runs</span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2 text-[14px] text-fg-2"
                    title={new Date(a.updated_at).toLocaleString()}
                  >
                    {formatRelativeTime(a.updated_at)}
                  </td>
                  <td className="w-10 px-3 py-2 relative">
                    <div ref={actionMenuId === a.id ? actionMenuRef : null}>
                      <button
                        type="button"
                        aria-label="More actions"
                        onClick={() =>
                          setActionMenuId(actionMenuId === a.id ? null : a.id)
                        }
                        className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors opacity-0 group-hover:opacity-100"
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
                      {actionMenuId === a.id ? (
                        <div className="absolute right-0 top-full mt-1 w-[200px] bg-bg-card border border-line rounded-md shadow-lg z-50 py-1">
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/automations/${a.id}`);
                              setActionMenuId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleEnabled(a)}
                            className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                          >
                            {a.status === "enabled" ? "Disable" : "Enable"}
                          </button>
                          <div className="my-1 border-t border-line" />
                          <button
                            type="button"
                            onClick={() => handleDelete(a)}
                            className="w-full px-3 py-1.5 text-left text-[13px] text-red-400 hover:bg-white/[0.08] hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-[13px] text-fg-2">
            {total} {total === 1 ? "automation" : "automations"}
          </div>
        </>
      )}
    </div>
  );
}
