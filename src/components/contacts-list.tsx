"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { RowActionsMenu } from "@/components/row-actions-menu";
import { StatusBadge } from "@/components/status-badge";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface ContactListItem {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "subscribed" | "unsubscribed";
  segments: string[];
  createdAt: string;
}

interface SegmentOption {
  id: string;
  name: string;
}

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

export function ContactsList() {
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(40);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState(
    () => searchParams.get("segmentId") ?? "",
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [after, setAfter] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [pageCursors, setPageCursors] = useState<string[]>([""]);
  const [segmentOptions, setSegmentOptions] = useState<SegmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const { exportState, exportCsv } = useDashboardCsvExport("contacts");

  const resetPagination = useCallback(() => {
    setPage(1);
    setAfter("");
    setPageCursors([""]);
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (after) params.set("after", after);
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (segmentFilter) params.set("segment_id", segmentFilter);

      const res = await fetch(`/api/contacts?${params.toString()}`);
      const data = await res.json();
      setContacts(data.data || []);
      setHasMore(Boolean(data.has_more));
    } catch {
      setContacts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [after, limit, search, statusFilter, segmentFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const requestedSegment = searchParams.get("segmentId") ?? "";
    setSegmentFilter(requestedSegment);
    resetPagination();
  }, [searchParams, resetPagination]);

  useEffect(() => {
    let active = true;

    async function fetchSegments() {
      try {
        const res = await fetch("/api/segments?limit=100");
        const data = (await res.json()) as {
          data?: Array<{ id?: unknown; name?: unknown }>;
        };
        if (!active) return;
        setSegmentOptions(
          (data.data ?? [])
            .filter(
              (segment): segment is { id: string; name: string } =>
                typeof segment.id === "string" &&
                typeof segment.name === "string",
            )
            .map((segment) => ({ id: segment.id, name: segment.name })),
        );
      } catch {
        if (active) setSegmentOptions([]);
      }
    }

    void fetchSegments();
    return () => {
      active = false;
    };
  }, []);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      resetPagination();
    }, 300);
  };

  const allSelected =
    contacts.length > 0 && selectedIds.size === contacts.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (segmentFilter) params.set("segment_id", segmentFilter);
    void exportCsv(params);
  };

  const goToPreviousPage = () => {
    if (page <= 1) return;
    const previousPage = page - 1;
    setPage(previousPage);
    setAfter(pageCursors[previousPage - 1] ?? "");
  };

  const goToNextPage = () => {
    if (!hasMore) return;
    const nextAfter = contacts.at(-1)?.id;
    if (!nextAfter) return;
    const nextPage = page + 1;
    setPageCursors((current) => {
      const next = current.slice(0, nextPage);
      next[nextPage - 1] = nextAfter;
      return next;
    });
    setPage(nextPage);
    setAfter(nextAfter);
  };

  return (
    <div className="min-w-0">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or multiple emails..."
          className="h-9 min-w-[220px] flex-1 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        <select
          value={segmentFilter}
          onChange={(e) => {
            setSegmentFilter(e.target.value);
            resetPagination();
          }}
          className="h-9 px-3 text-[13px] bg-bg-card border border-line rounded-md text-fg outline-none cursor-pointer appearance-none pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="">All contacts</option>
          {segmentOptions.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            resetPagination();
          }}
          className="h-9 px-3 text-[13px] bg-bg-card border border-line rounded-md text-fg outline-none cursor-pointer appearance-none pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
          <option value="">All subscriptions</option>
          <option value="subscribed">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>

        <ExportStatusMessage state={exportState} />
        <button
          type="button"
          onClick={handleExport}
          disabled={exportState.type === "loading"}
          className="h-9 px-3 text-[13px] text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export
        </button>
      </div>

      {/* Data table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          Loading contacts...
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          No contacts found
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-white rounded cursor-pointer"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                    Email
                  </th>
                  <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                    Segments
                  </th>
                  <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                    Added
                  </th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    selected={selectedIds.has(contact.id)}
                    onToggle={() => toggleRow(contact.id)}
                    onDeleted={fetchContacts}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-[13px] text-fg-2">
            <span>
              Page {page} – showing {contacts.length} contacts
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={goToPreviousPage}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:border-line-3 transition-colors"
              >
                ←
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={goToNextPage}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:border-line-3 transition-colors"
              >
                →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  selected,
  onToggle,
  onDeleted,
}: {
  contact: ContactListItem;
  selected: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const displayName = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <tr className="border-b border-line hover:bg-bg-2 transition-colors group">
      <td className="w-10 px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="accent-white rounded cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="px-3 py-2 text-[14px] text-fg">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
            style={{ backgroundColor: getAvatarColor(contact.email) }}
          >
            {contact.email.charAt(0).toUpperCase()}
          </div>
          <Link
            href={`/audience/contacts/${contact.id}`}
            className="text-fg hover:underline"
          >
            {contact.email}
          </Link>
          {displayName && (
            <span className="text-fg-2 text-[13px]">{displayName}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-[14px] text-fg-2">
        {contact.segments.length > 0 ? contact.segments.join(", ") : "—"}
      </td>
      <td className="px-3 py-2">
        <StatusBadge
          status={
            contact.status === "subscribed" ? "Subscribed" : "Unsubscribed"
          }
          variant={contact.status === "subscribed" ? "success" : "default"}
        />
      </td>
      <td
        className="px-3 py-2 text-[14px] text-fg-2"
        title={new Date(contact.createdAt).toLocaleString()}
      >
        {formatRelativeTime(contact.createdAt)}
      </td>
      <td className="w-10 px-3 py-2 relative">
        <RowActionsMenu
          actions={[
            {
              label: "View / edit",
              onSelect: () => {
                window.location.href = `/audience/contacts/${contact.id}`;
              },
            },
          ]}
          deleteAction={{
            label: "Delete contact",
            confirmText: `Permanently delete ${contact.email}? This cannot be undone.`,
            onConfirm: async () => {
              const res = await fetch(`/api/contacts/${contact.id}`, {
                method: "DELETE",
              });
              if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as {
                  error?: string;
                };
                throw new Error(body.error ?? `Server error ${res.status}`);
              }
              onDeleted();
            },
          }}
        />
      </td>
    </tr>
  );
}
