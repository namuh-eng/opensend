"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface Segment {
  id: string;
  name: string;
  contactsCount: number;
  unsubscribedCount: number;
  createdAt: string;
}

export function SegmentsList() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const { exportState, exportCsv } = useDashboardCsvExport("segments");

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);

      const res = await fetch(`/api/segments?${params.toString()}`);
      const data = await res.json();
      setSegments(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setSegments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  const allSelected =
    segments.length > 0 && selectedIds.size === segments.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(segments.map((s) => s.id)));
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
    void exportCsv(params);
  };

  const totalPages = Math.ceil(total / limit);
  const start = total === 0 ? 0 : (page - 1) * limit + 1;

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

        <ExportStatusMessage state={exportState} />
        <button
          type="button"
          onClick={handleExport}
          disabled={exportState.type === "loading"}
          className="h-9 px-3 text-[13px] text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export
        </button>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-white/[0.12] transition-colors"
        >
          Create segment
        </button>
      </div>

      {/* Data table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          Loading segments...
        </div>
      ) : segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <h3 className="text-[16px] font-semibold text-fg mb-2">
            No segments
          </h3>
          <p className="text-[14px] text-fg-2 text-center max-w-[360px] mb-6">
            Segments let you group contacts based on shared characteristics.
          </p>
        </div>
      ) : (
        <>
          <table className="w-full">
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
                  Name
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Contacts
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Unsubscribed
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                  Created
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr
                  key={seg.id}
                  className="border-b border-line hover:bg-bg-2 transition-colors group"
                >
                  <td className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(seg.id)}
                      onChange={() => toggleRow(seg.id)}
                      className="accent-white rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg">
                    <Link
                      href={`/audience?segmentId=${seg.id}`}
                      className="hover:underline"
                    >
                      {seg.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {seg.contactsCount}
                  </td>
                  <td className="px-3 py-2 text-[14px] text-fg-2">
                    {seg.unsubscribedCount}
                  </td>
                  <td
                    className="px-3 py-2 text-[14px] text-fg-2"
                    title={new Date(seg.createdAt).toLocaleString()}
                  >
                    {formatRelativeTime(seg.createdAt)}
                  </td>
                  <td className="w-10 px-3 py-2 relative">
                    <button
                      type="button"
                      aria-label="More actions"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-[13px] text-fg-2">
            <span>
              Page {page} – {start} of {total} segments – {limit} items
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:border-line-3 transition-colors"
              >
                &larr;
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-line disabled:opacity-30 hover:border-line-3 transition-colors"
              >
                &rarr;
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create Segment Modal */}
      {showModal && (
        <CreateSegmentModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            fetchSegments();
          }}
        />
      )}
    </div>
  );
}

function CreateSegmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/segments", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create segment");
        return;
      }
      onCreated();
    } catch {
      setError("Failed to create segment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        role="presentation"
      />
      <div className="relative bg-bg-card border border-line rounded-lg w-[440px] p-6">
        <h2 className="text-[16px] font-semibold text-fg mb-4">
          Create a new segment
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="segment-name"
              className="block text-[13px] text-fg-2 mb-1.5"
            >
              Name
            </label>
            <input
              id="segment-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              placeholder="Your segment name"
              className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
            />
          </div>

          {error && <p className="text-[13px] text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-[13px] text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-white/[0.12] transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
