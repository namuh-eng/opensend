"use client";

import { formatRelativeTime } from "@/components/emails-sending-data-table";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Broadcast {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

type ApiBroadcast = {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
};

type ApiListResponse = {
  data?: unknown;
  total?: unknown;
  has_more?: unknown;
  error?: unknown;
};

interface SegmentOption {
  id: string;
  name: string;
}

export interface BroadcastsListProps {
  initialBroadcasts?: Broadcast[];
  initialTotal?: number;
  initialPage?: number;
  initialLimit?: number;
  initialSearch?: string;
  initialStatusFilter?: string;
  initialAudienceFilter?: string;
  initialError?: string | null;
}

const BROADCAST_STATUSES = [
  "Draft",
  "Scheduled",
  "Queued",
  "Sent",
  "Failed",
] as const;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getApiKey(): string | null {
  try {
    return typeof window !== "undefined"
      ? (window.localStorage.getItem("api_key") ?? null)
      : null;
  } catch {
    return null;
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toApiListResponse(value: unknown): ApiListResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  return value as ApiListResponse;
}

function normalizeBroadcast(value: unknown): Broadcast | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as ApiBroadcast;
  const id = typeof record.id === "string" ? record.id : "";
  const name = typeof record.name === "string" ? record.name : "";
  const status = typeof record.status === "string" ? record.status : "";
  const createdAt =
    typeof record.createdAt === "string"
      ? record.createdAt
      : typeof record.created_at === "string"
        ? record.created_at
        : "";

  if (!id || !name || !status || !createdAt) return null;

  return { id, name, status, createdAt };
}

function normalizeBroadcasts(data: unknown): Broadcast[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const broadcast = normalizeBroadcast(item);
    return broadcast ? [broadcast] : [];
  });
}

function responseErrorMessage(response: ApiListResponse): string {
  return typeof response.error === "string"
    ? response.error
    : "Failed to load broadcasts.";
}

export function BroadcastsList({
  initialBroadcasts,
  initialTotal,
  initialPage,
  initialLimit,
  initialSearch,
  initialStatusFilter,
  initialAudienceFilter,
  initialError = null,
}: BroadcastsListProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasInitialBroadcasts = initialBroadcasts !== undefined;
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(
    initialBroadcasts ?? [],
  );
  const [total, setTotal] = useState(
    initialTotal ?? initialBroadcasts?.length ?? 0,
  );
  const [page, setPage] = useState(initialPage ?? 1);
  const [limit, setLimit] = useState(initialLimit ?? 40);
  const [search, setSearch] = useState(
    initialSearch ?? searchParams.get("search") ?? "",
  );
  const [statusFilter, setStatusFilter] = useState(
    initialStatusFilter ?? searchParams.get("status") ?? "",
  );
  const [audienceFilter, setAudienceFilter] = useState(
    initialAudienceFilter ?? searchParams.get("segmentId") ?? "",
  );
  const [loading, setLoading] = useState(
    !hasInitialBroadcasts && !initialError,
  );
  const [error, setError] = useState<string | null>(initialError);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [audienceDropdownOpen, setAudienceDropdownOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const skipInitialFetch = useRef(
    hasInitialBroadcasts || Boolean(initialError),
  );
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const audienceDropdownRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const { exportState, exportCsv } = useDashboardCsvExport("broadcasts");

  const fetchBroadcasts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (audienceFilter) params.set("segmentId", audienceFilter);

      const apiKey = getApiKey();
      const authHeaders: Record<string, string> = {};
      if (apiKey) authHeaders.Authorization = `Bearer ${apiKey}`;
      const res = await fetch(`/api/broadcasts?${params.toString()}`, {
        headers: authHeaders,
        signal: controller.signal,
      });
      const data = toApiListResponse(await parseJsonResponse(res));
      if (!res.ok) {
        throw new Error(responseErrorMessage(data));
      }
      const nextBroadcasts = normalizeBroadcasts(data.data);
      setBroadcasts(nextBroadcasts);
      setTotal(
        typeof data.total === "number"
          ? data.total
          : data.has_more === true
            ? nextBroadcasts.length + 1
            : nextBroadcasts.length,
      );
    } catch (fetchError) {
      setBroadcasts([]);
      setTotal(0);
      setError(
        fetchError instanceof Error && fetchError.name === "AbortError"
          ? "Loading broadcasts timed out. Please retry."
          : fetchError instanceof Error
            ? fetchError.message
            : "Failed to load broadcasts.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, audienceFilter]);

  const fetchSegments = useCallback(async () => {
    try {
      const apiKey = getApiKey();
      const authHeaders: Record<string, string> = {};
      if (apiKey) authHeaders.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/segments?limit=100", {
        headers: authHeaders,
      });
      const data = await res.json();
      setSegments(data.data || []);
    } catch {
      setSegments([]);
    }
  }, []);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  useEffect(() => {
    const nextSearch = searchParams.get("search") || "";
    const nextStatus = searchParams.get("status") || "";
    const nextAudience = searchParams.get("segmentId") || "";
    const nextPage = Number(searchParams.get("page")) || 1;
    const nextLimit = Number(searchParams.get("limit")) || 40;

    setSearch(nextSearch);
    setStatusFilter(nextStatus);
    setAudienceFilter(nextAudience);
    setPage(Math.max(1, nextPage));
    setLimit(nextLimit === 80 || nextLimit === 120 ? nextLimit : 40);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) {
      params.set("page", String(page));
    }
    if (limit !== 40) {
      params.set("limit", String(limit));
    }
    if (search) {
      params.set("search", search);
    }
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    if (audienceFilter) {
      params.set("segmentId", audienceFilter);
    }

    const nextUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    router.replace(nextUrl);
  }, [page, limit, search, statusFilter, audienceFilter, pathname, router]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
      if (
        audienceDropdownRef.current &&
        !audienceDropdownRef.current.contains(e.target as Node)
      ) {
        setAudienceDropdownOpen(false);
      }
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(e.target as Node)
      ) {
        setActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  const handleCreateEmail = async () => {
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Untitled" }),
      });
      if (res.ok) {
        const broadcast = await res.json();
        router.push(`/broadcasts/${broadcast.id}/editor`);
      }
    } catch {
      // ignore
    }
  };

  const handleDuplicate = async (bc: Broadcast) => {
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `${bc.name} (copy)` }),
      });
      if (res.ok) {
        fetchBroadcasts();
      }
    } catch {
      // ignore
    }
    setActionMenuId(null);
  };

  const handleRemove = async (id: string) => {
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const authHeaders: Record<string, string> = {};
      if (apiKey) authHeaders.Authorization = `Bearer ${apiKey}`;
      await fetch(`/api/broadcasts/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      fetchBroadcasts();
    } catch {
      // ignore
    }
    setActionMenuId(null);
  };

  const allSelected =
    broadcasts.length > 0 && selectedIds.size === broadcasts.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(broadcasts.map((b) => b.id)));
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
    if (audienceFilter) params.set("segmentId", audienceFilter);
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
          className="flex-1 h-9 px-3 text-[13px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md text-[#F0F0F0] placeholder-[#666] outline-none focus:border-[rgba(176,199,217,0.3)]"
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        {/* Status filter */}
        <div className="relative" ref={statusDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setStatusDropdownOpen(!statusDropdownOpen);
              setAudienceDropdownOpen(false);
            }}
            className="h-9 px-3 text-[13px] border border-[rgba(176,199,217,0.145)] rounded-md text-[#A1A4A5] hover:text-[#F0F0F0] hover:border-[rgba(176,199,217,0.3)] transition-colors flex items-center gap-1.5 min-w-[130px]"
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
          {statusDropdownOpen && (
            <div
              role="menu"
              className="absolute top-full left-0 mt-1 w-[180px] bg-[#0a0a0a] border border-[rgba(176,199,217,0.145)] rounded-md shadow-lg z-50 py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStatusFilter("");
                  setStatusDropdownOpen(false);
                  setPage(1);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-[rgba(176,199,217,0.08)] transition-colors ${!statusFilter ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
              >
                All Statuses
              </button>
              {BROADCAST_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  role="menuitem"
                  onClick={() => {
                    setStatusFilter(s.toLowerCase());
                    setStatusDropdownOpen(false);
                    setPage(1);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-[rgba(176,199,217,0.08)] transition-colors ${statusFilter === s.toLowerCase() ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Audiences filter */}
        <div className="relative" ref={audienceDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setAudienceDropdownOpen(!audienceDropdownOpen);
              setStatusDropdownOpen(false);
            }}
            className="h-9 px-3 text-[13px] border border-[rgba(176,199,217,0.145)] rounded-md text-[#A1A4A5] hover:text-[#F0F0F0] hover:border-[rgba(176,199,217,0.3)] transition-colors flex items-center gap-1.5 min-w-[140px]"
          >
            <span>
              {audienceFilter
                ? segments.find((s) => s.id === audienceFilter)?.name ||
                  "All Audiences"
                : "All Audiences"}
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
          {audienceDropdownOpen && (
            <div
              role="menu"
              className="absolute top-full left-0 mt-1 w-[200px] bg-[#0a0a0a] border border-[rgba(176,199,217,0.145)] rounded-md shadow-lg z-50 py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setAudienceFilter("");
                  setAudienceDropdownOpen(false);
                  setPage(1);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-[rgba(176,199,217,0.08)] transition-colors ${!audienceFilter ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
              >
                All Audiences
              </button>
              {segments.map((seg) => (
                <button
                  type="button"
                  key={seg.id}
                  role="menuitem"
                  onClick={() => {
                    setAudienceFilter(seg.id);
                    setAudienceDropdownOpen(false);
                    setPage(1);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-[rgba(176,199,217,0.08)] transition-colors ${audienceFilter === seg.id ? "text-[#F0F0F0]" : "text-[#A1A4A5]"}`}
                >
                  {seg.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export button */}
        <ExportStatusMessage state={exportState} />
        <button
          type="button"
          onClick={handleExport}
          disabled={exportState.type === "loading"}
          className="h-9 w-9 flex items-center justify-center border border-[rgba(176,199,217,0.145)] rounded-md text-[#A1A4A5] hover:text-[#F0F0F0] hover:border-[rgba(176,199,217,0.3)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Export"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleCreateEmail}
          className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1.5"
        >
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
          Create email
        </button>
      </div>

      {/* Data table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-[#A1A4A5]">
          Loading broadcasts...
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <h3 className="text-[16px] font-semibold text-[#F0F0F0] mb-2">
            Unable to load broadcasts
          </h3>
          <p className="text-[14px] text-[#A1A4A5] text-center max-w-[420px] mb-6">
            {error}
          </p>
          <button
            type="button"
            onClick={fetchBroadcasts}
            className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-gray-200 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <h3 className="text-[16px] font-semibold text-[#F0F0F0] mb-2">
            No broadcasts
          </h3>
          <p className="text-[14px] text-[#A1A4A5] text-center max-w-[360px] mb-6">
            Send targeted emails to your audience with broadcasts.
          </p>
        </div>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(176,199,217,0.145)]">
                <th className="w-10 px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-white rounded cursor-pointer"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5] tracking-normal">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5] tracking-normal">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-[12px] font-medium text-[#A1A4A5] tracking-normal">
                  Created
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((bc) => (
                <tr
                  key={bc.id}
                  className="border-b border-[rgba(176,199,217,0.145)] hover:bg-[rgba(24,25,28,0.5)] transition-colors group"
                >
                  <td className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(bc.id)}
                      onChange={() => toggleRow(bc.id)}
                      className="accent-white rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-[14px] text-[#F0F0F0]">
                    <Link
                      href={`/broadcasts/${bc.id}/editor`}
                      className="hover:underline"
                    >
                      {bc.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[14px] text-[#A1A4A5]">
                    {capitalize(bc.status)}
                  </td>
                  <td
                    className="px-3 py-2 text-[14px] text-[#A1A4A5]"
                    title={new Date(bc.createdAt).toLocaleString()}
                  >
                    {formatRelativeTime(bc.createdAt)}
                  </td>
                  <td className="w-10 px-3 py-2 relative">
                    <div ref={actionMenuId === bc.id ? actionMenuRef : null}>
                      <button
                        type="button"
                        aria-label="More actions"
                        onClick={() =>
                          setActionMenuId(actionMenuId === bc.id ? null : bc.id)
                        }
                        className="p-1 rounded hover:bg-[rgba(176,199,217,0.145)] text-[#A1A4A5] hover:text-[#F0F0F0] transition-colors opacity-0 group-hover:opacity-100"
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
                      {actionMenuId === bc.id && (
                        <div className="absolute right-0 top-full mt-1 w-[200px] bg-[#0a0a0a] border border-[rgba(176,199,217,0.145)] rounded-md shadow-lg z-50 py-1">
                          <button
                            type="button"
                            onClick={() => {
                              router.push(`/broadcasts/${bc.id}/editor`);
                              setActionMenuId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-[13px] text-[#A1A4A5] hover:bg-[rgba(176,199,217,0.08)] hover:text-[#F0F0F0] transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(bc)}
                            className="w-full px-3 py-1.5 text-left text-[13px] text-[#A1A4A5] hover:bg-[rgba(176,199,217,0.08)] hover:text-[#F0F0F0] transition-colors"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionMenuId(null)}
                            className="w-full px-3 py-1.5 text-left text-[13px] text-[#A1A4A5] hover:bg-[rgba(176,199,217,0.08)] hover:text-[#F0F0F0] transition-colors"
                          >
                            Clone as template
                          </button>
                          <div className="my-1 border-t border-[rgba(176,199,217,0.145)]" />
                          <button
                            type="button"
                            onClick={() => handleRemove(bc.id)}
                            className="w-full px-3 py-1.5 text-left text-[13px] text-red-400 hover:bg-[rgba(176,199,217,0.08)] hover:text-red-300 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-[13px] text-[#A1A4A5]">
            <span>
              Page {page} – {start} of {total} broadcasts – {limit} items
            </span>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 px-2 text-[12px] bg-transparent border border-[rgba(176,199,217,0.145)] rounded text-[#A1A4A5] outline-none cursor-pointer"
              >
                <option value={40}>40</option>
                <option value={80}>80</option>
                <option value={120}>120</option>
              </select>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 rounded border border-[rgba(176,199,217,0.145)] disabled:opacity-30 hover:border-[rgba(176,199,217,0.3)] transition-colors"
              >
                &larr;
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 rounded border border-[rgba(176,199,217,0.145)] disabled:opacity-30 hover:border-[rgba(176,199,217,0.3)] transition-colors"
              >
                &rarr;
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
