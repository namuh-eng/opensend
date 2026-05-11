"use client";

import { DataTable } from "@/components/data-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

type AuditLogRow = {
  id: string;
  actorType: string;
  actorId: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  source: string;
  sourceApiKeyId: string | null;
  metadata: unknown;
  createdAt: string;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatMetadata(metadata: unknown): string {
  if (metadata == null) return "—";
  if (typeof metadata === "string") return metadata;
  try {
    return JSON.stringify(metadata);
  } catch {
    return "[unserializable]";
  }
}

function label(value: string): string {
  return value.replace(/[._-]/g, " ");
}

const ACTION_OPTIONS = [
  "api_key.created",
  "api_key.updated",
  "api_key.deleted",
  "domain.created",
  "domain.updated",
  "domain.deleted",
  "domain.verified",
  "webhook.created",
  "webhook.updated",
  "webhook.deleted",
];

const TARGET_OPTIONS = ["api_key", "domain", "webhook", "settings", "team"];
const SOURCE_OPTIONS = ["dashboard", "api_key", "system"];

export function AuditLogListPage({ events }: { events: AuditLogRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(
    searchParams.get("q") || searchParams.get("search") || "",
  );
  const [action, setAction] = useState(searchParams.get("action") || "all");
  const [targetType, setTargetType] = useState(
    searchParams.get("targetType") || "all",
  );
  const [source, setSource] = useState(searchParams.get("source") || "all");
  const [dateFrom, setDateFrom] = useState(searchParams.get("after") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("before") || "");

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
      const suffix = params.toString();
      router.push(suffix ? `${pathname}?${suffix}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const handleExport = useCallback(() => {
    const headers = [
      "ID",
      "Actor",
      "Action",
      "Target Type",
      "Target ID",
      "Source",
      "Created At",
      "Metadata",
    ];
    const csvRows = events.map((event) =>
      [
        event.id,
        event.actorEmail || `${event.actorType}:${event.actorId}`,
        event.action,
        event.targetType,
        event.targetId,
        event.source,
        event.createdAt,
        formatMetadata(event.metadata),
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-export-${new Date().toISOString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [events]);

  const columns = [
    {
      key: "actor",
      header: "Actor",
      render: (row: AuditLogRow) => (
        <div className="flex flex-col">
          <span className="text-[13px] text-[#F0F0F0]">
            {row.actorEmail || row.actorId}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[#A1A4A5]">
            {label(row.actorType)}
          </span>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (row: AuditLogRow) => (
        <span className="font-mono text-[13px] text-[#F0F0F0]">
          {row.action}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target",
      render: (row: AuditLogRow) => (
        <div className="flex flex-col">
          <span className="text-[13px] capitalize text-[#F0F0F0]">
            {label(row.targetType)}
          </span>
          <span className="font-mono text-[11px] text-[#A1A4A5]">
            {row.targetId}
          </span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      render: (row: AuditLogRow) => (
        <div className="flex flex-col">
          <span className="text-[13px] capitalize text-[#F0F0F0]">
            {label(row.source)}
          </span>
          {row.sourceApiKeyId ? (
            <Link
              href={`/logs?apiKeyId=${row.sourceApiKeyId}`}
              className="text-[11px] text-blue-300 hover:underline"
            >
              Related API request logs
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (row: AuditLogRow) => (
        <span className="text-[13px] text-[#A1A4A5]">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: "metadata",
      header: "Metadata",
      render: (row: AuditLogRow) => (
        <code className="block max-w-xs truncate text-[12px] text-[#A1A4A5]">
          {formatMetadata(row.metadata)}
        </code>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F0F0]">Audit Log</h1>
          <p className="mt-1 text-[14px] text-[#A1A4A5]">
            Durable account activity for security-sensitive changes. API request
            troubleshooting remains on the Logs page.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="h-9 rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(176,199,217,0.145)] px-4 text-[13px] font-medium text-[#F0F0F0] transition-colors hover:bg-[rgba(176,199,217,0.2)]"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label htmlFor="audit-search" className="sr-only">
          Search audit log
        </label>
        <input
          id="audit-search"
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            updateFilters({ q: value });
          }}
          placeholder="Search audit log by actor, action, target, or metadata"
          className="min-w-[320px] rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] text-[#F0F0F0] focus:outline-none focus:ring-1 focus:ring-[rgba(176,199,217,0.3)]"
        />

        <select
          aria-label="Filter by action"
          value={action}
          onChange={(event) => {
            const value = event.target.value;
            setAction(value);
            updateFilters({ action: value === "all" ? "" : value });
          }}
          className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] text-[#F0F0F0]"
        >
          <option value="all">All actions</option>
          {ACTION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by target type"
          value={targetType}
          onChange={(event) => {
            const value = event.target.value;
            setTargetType(value);
            updateFilters({ targetType: value === "all" ? "" : value });
          }}
          className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] text-[#F0F0F0]"
        >
          <option value="all">All targets</option>
          {TARGET_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {label(option)}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by source"
          value={source}
          onChange={(event) => {
            const value = event.target.value;
            setSource(value);
            updateFilters({ source: value === "all" ? "" : value });
          }}
          className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] text-[#F0F0F0]"
        >
          <option value="all">All sources</option>
          {SOURCE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {label(option)}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-[12px] text-[#A1A4A5]">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              const value = event.target.value;
              setDateFrom(value);
              updateFilters({ after: value });
            }}
            className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] text-[#F0F0F0]"
          />
        </label>

        <label className="flex items-center gap-2 text-[12px] text-[#A1A4A5]">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              const value = event.target.value;
              setDateTo(value);
              updateFilters({ before: value });
            }}
            className="rounded-md border border-[rgba(176,199,217,0.145)] bg-[rgba(24,25,28,0.88)] px-3 py-1.5 text-[13px] text-[#F0F0F0]"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-[rgba(176,199,217,0.145)]">
        <DataTable
          columns={columns}
          rows={events}
          getRowId={(row) => row.id}
          emptyMessage="No audit events found"
        />
      </div>
    </div>
  );
}
