"use client";

import {
  DASHBOARD_EXPORT_LIMIT,
  DASHBOARD_EXPORT_RESOURCES,
  type DashboardExportResource,
  dashboardExportLabel,
} from "@/lib/dashboard-export-types";
import { useMemo, useState } from "react";

type ExportJob = {
  id: string;
  resource: DashboardExportResource;
  status: "completed" | "failed" | "expired";
  schemaVersion: number;
  filters: Record<string, string | number | boolean | null>;
  filename: string;
  rowCount: number;
  byteSize: number;
  error: string | null;
  createdByEmail: string | null;
  createdAt: string;
  expiresAt: string;
  downloadCount: number;
};

type ExportCenterPageProps = {
  initialJobs: ExportJob[];
};

const resourceOptions = DASHBOARD_EXPORT_RESOURCES;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

function filtersSummary(filters: ExportJob["filters"]): string {
  const entries = Object.entries(filters);
  if (entries.length === 0) return "No filters";
  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

export function ExportCenterPage({ initialJobs }: ExportCenterPageProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const [resource, setResource] = useState<DashboardExportResource>("emails");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  const resourceLabel = useMemo(
    () => dashboardExportLabel(resource),
    [resource],
  );

  async function createExport() {
    setCreating(true);
    setMessage(`Creating ${resourceLabel} export…`);
    try {
      const response = await fetch("/api/dashboard/export-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resource,
          filters: {
            search: search.trim() || undefined,
            status: status.trim() || undefined,
          },
        }),
      });

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const error =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Failed to create export.";
        throw new Error(error);
      }

      const job = (await response.json()) as ExportJob;
      setJobs((current) => [
        job,
        ...current.filter((item) => item.id !== job.id),
      ]);
      setMessage(
        job.status === "completed"
          ? `Export ready with ${job.rowCount} ${resourceLabel} row${job.rowCount === 1 ? "" : "s"}.`
          : (job.error ?? "Export failed."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to create export.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.16em] text-fg-3">
            Dashboard exports
          </p>
          <h1 className="text-2xl font-semibold text-fg">Export Center</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-fg-2">
            Create tenant-scoped CSV exports for stable dashboard resources.
            Jobs are generated synchronously up to{" "}
            {DASHBOARD_EXPORT_LIMIT.toLocaleString()} rows, stored for seven
            days, and re-authorized at download time.
          </p>
        </div>
        <a
          className="btn btn-ghost btn-sm"
          href="/docs/dashboard/export-center"
        >
          Export docs
        </a>
      </div>

      <section className="rounded-card border border-line bg-bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_180px_auto] md:items-end">
          <label className="grid gap-1 text-[12px] text-fg-2">
            Resource
            <select
              className="input h-9"
              value={resource}
              onChange={(event) =>
                setResource(event.target.value as DashboardExportResource)
              }
              aria-label="Export resource"
            >
              {resourceOptions.map((option) => (
                <option key={option} value={option}>
                  {dashboardExportLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[12px] text-fg-2">
            Search filter
            <input
              className="input h-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Optional search text"
            />
          </label>
          <label className="grid gap-1 text-[12px] text-fg-2">
            Status/type
            <input
              className="input h-9"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary h-9"
            onClick={createExport}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create export"}
          </button>
        </div>
        {message && (
          <output className="mt-3 block text-[12px] text-fg-2">
            {message}
          </output>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-bg-card shadow-sm">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Export history</h2>
          <p className="mt-1 text-[12px] text-fg-3">
            Download links expire after seven days and require an active
            dashboard session.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-fg-3">
                <th className="px-4 py-2 font-medium">Resource</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Rows</th>
                <th className="px-4 py-2 font-medium">Schema</th>
                <th className="px-4 py-2 font-medium">Filters</th>
                <th className="px-4 py-2 font-medium">Expires</th>
                <th className="px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-fg-3" colSpan={7}>
                    No exports yet. Create one above.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg">
                        {dashboardExportLabel(job.resource)}
                      </div>
                      <div className="mono text-[11px] text-fg-4">
                        {formatDate(job.createdAt)} ·{" "}
                        {formatBytes(job.byteSize)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-2">{job.status}</td>
                    <td className="px-4 py-3 text-fg-2">{job.rowCount}</td>
                    <td className="px-4 py-3 text-fg-2">
                      v{job.schemaVersion}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3 text-fg-3">
                      {job.error ?? filtersSummary(job.filters)}
                    </td>
                    <td className="px-4 py-3 text-fg-2">
                      {formatDate(job.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      {job.status === "completed" ? (
                        <a
                          className="btn btn-ghost btn-sm"
                          href={`/api/dashboard/export-jobs/${job.id}/download`}
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-fg-4">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
