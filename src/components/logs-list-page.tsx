"use client";

import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

interface LogRow {
  id: string;
  method: string | null;
  endpoint: string | null;
  statusCode: number | null;
  createdAt: string;
}

function getMethodVariant(
  method: string,
): "success" | "error" | "warning" | "info" | "default" {
  switch (method.toUpperCase()) {
    case "GET":
      return "info";
    case "POST":
      return "success";
    case "PUT":
    case "PATCH":
      return "warning";
    case "DELETE":
      return "error";
    default:
      return "default";
  }
}

function getStatusVariant(
  code: number,
): "success" | "error" | "warning" | "info" | "default" {
  if (code >= 200 && code < 300) return "success";
  if (code >= 300 && code < 400) return "info";
  if (code >= 400 && code < 500) return "warning";
  if (code >= 500) return "error";
  return "default";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const seconds = d.getSeconds().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${month} ${day}, ${h}:${minutes}:${seconds} ${ampm}`;
}

export function LogsListPage({ logs }: { logs: LogRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all",
  );
  const [dateFrom, setDateFrom] = useState<string>(
    searchParams.get("after") || "",
  );
  const [dateTo, setDateTo] = useState<string>(
    searchParams.get("before") || "",
  );
  const [query, setQuery] = useState<string>(
    searchParams.get("q") || searchParams.get("search") || "",
  );

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const { exportState, exportCsv } = useDashboardCsvExport("logs");

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (dateFrom) params.set("after", dateFrom);
    if (dateTo) params.set("before", dateTo);
    if (query.trim()) params.set("q", query.trim());
    void exportCsv(params);
  }, [dateFrom, dateTo, exportCsv, query, statusFilter]);

  const columns = [
    {
      key: "method",
      header: "Method",
      sortable: true,
      render: (row: LogRow) => (
        <StatusBadge
          status={(row.method ?? "GET").toUpperCase()}
          variant={getMethodVariant(row.method ?? "GET")}
        />
      ),
    },
    {
      key: "endpoint",
      header: "Endpoint",
      sortable: true,
      render: (row: LogRow) => (
        <span className="font-mono text-[13px]">{row.endpoint ?? "-"}</span>
      ),
    },
    {
      key: "statusCode",
      header: "Status",
      sortable: true,
      render: (row: LogRow) => (
        <StatusBadge
          status={String(row.statusCode ?? 0)}
          variant={getStatusVariant(row.statusCode ?? 0)}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (row: LogRow) => (
        <span className="text-fg-2 text-[13px]">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-fg">Logs</h1>
        <div className="flex items-center gap-3">
          <ExportStatusMessage state={exportState} />
          <button
            type="button"
            onClick={handleExport}
            disabled={exportState.type === "loading"}
            className="h-9 px-4 text-[13px] font-medium bg-white/[0.14] text-fg border border-line rounded-md hover:bg-white/20 transition-colors flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <label htmlFor="log-search" className="sr-only">
          Search logs
        </label>
        <input
          id="log-search"
          type="search"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            updateFilters({ q: val });
          }}
          placeholder="Search logs by email id, endpoint, status, or body"
          className="min-w-[320px] bg-bg-3 border border-line text-fg text-[13px] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[rgba(176,199,217,0.3)]"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            const val = e.target.value;
            setStatusFilter(val);
            updateFilters({ status: val === "all" ? "" : val });
          }}
          className="bg-bg-3 border border-line text-fg text-[13px] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[rgba(176,199,217,0.3)]"
        >
          <option value="all">All statuses</option>
          <option value="2xx">2xx Success</option>
          <option value="4xx">4xx Client Error</option>
          <option value="5xx">5xx Server Error</option>
        </select>

        <div className="flex items-center gap-2">
          <label htmlFor="date-from" className="text-[12px] text-fg-2">
            From
          </label>
          <input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              const val = e.target.value;
              setDateFrom(val);
              updateFilters({ after: val });
            }}
            className="bg-bg-3 border border-line text-fg text-[13px] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[rgba(176,199,217,0.3)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="date-to" className="text-[12px] text-fg-2">
            To
          </label>
          <input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              const val = e.target.value;
              setDateTo(val);
              updateFilters({ before: val });
            }}
            className="bg-bg-3 border border-line text-fg text-[13px] rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[rgba(176,199,217,0.3)]"
          />
        </div>

        {(statusFilter !== "all" || dateFrom || dateTo || query) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setDateFrom("");
              setDateTo("");
              setQuery("");
              updateFilters({ status: "", after: "", before: "", q: "" });
            }}
            className="text-[12px] text-fg-2 hover:text-fg transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-line rounded-lg overflow-hidden">
        <DataTable
          columns={columns}
          rows={logs}
          getRowId={(row) => row.id}
          onRowClick={(row) => router.push(`/logs/${row.id}`)}
          emptyMessage="No logs found"
        />
      </div>
    </div>
  );
}
