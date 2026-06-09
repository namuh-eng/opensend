"use client";

import { DataTable } from "@/components/data-table";
import type { Column, RowAction } from "@/components/data-table";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type SuppressionReason = "bounced" | "complained" | "manual";
type SuppressionSource = "manual" | "operator" | "ses";

export type SuppressionDashboardRow = {
  id: string;
  email: string;
  reason: SuppressionReason;
  source: string;
  sourceEmailId: string | null;
  sourceMessageId: string | null;
  suppressedAt: string;
  updatedAt: string;
};

type ImportError = {
  row: number;
  field: string;
  value?: string;
  message: string;
};

type ImportResponse = {
  imported_count: number;
  rejected_count: number;
  limit: number;
  errors: ImportError[];
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function reasonVariant(
  reason: SuppressionReason,
): "success" | "error" | "warning" | "info" | "default" {
  if (reason === "bounced") return "warning";
  if (reason === "complained") return "error";
  return "default";
}

function buildCsvFromText(text: string): string {
  return text.trim();
}

export function SuppressionsListPage({
  suppressions,
}: {
  suppressions: SuppressionDashboardRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { exportCsv, exportState } = useDashboardCsvExport("suppressions");

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [reason, setReason] = useState(searchParams.get("reason") ?? "all");
  const [source, setSource] = useState(searchParams.get("source") ?? "all");
  const [createdAfter, setCreatedAfter] = useState(
    searchParams.get("created_after") ?? "",
  );
  const [createdBefore, setCreatedBefore] = useState(
    searchParams.get("created_before") ?? "",
  );
  const [domain, setDomain] = useState(searchParams.get("domain") ?? "");
  const [topicId, setTopicId] = useState(searchParams.get("topic_id") ?? "");

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<SuppressionDashboardRow | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newReason, setNewReason] = useState<SuppressionReason>("manual");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [importCsv, setImportCsv] = useState("email,reason\n");
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const updateFilters = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "all") params.set(key, value);
        else params.delete(key);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (reason !== "all") params.set("status", reason);
    if (source !== "all") params.set("source", source);
    if (createdAfter) params.set("created_after", createdAfter);
    if (createdBefore) params.set("created_before", createdBefore);
    if (domain.trim()) params.set("domain", domain.trim());
    if (topicId.trim()) params.set("topic_id", topicId.trim());
    return params;
  }, [createdAfter, createdBefore, domain, query, reason, source, topicId]);

  const columns: Column<SuppressionDashboardRow>[] = [
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-[13px]">{row.email}</span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      sortable: true,
      render: (row) => (
        <StatusBadge status={row.reason} variant={reasonVariant(row.reason)} />
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      render: (row) => <span className="text-fg-2">{row.source || "—"}</span>,
    },
    {
      key: "sourceEmailId",
      header: "Source email",
      render: (row) => (
        <span className="font-mono text-[12px] text-fg-2">
          {row.sourceEmailId ?? "—"}
        </span>
      ),
    },
    {
      key: "suppressedAt",
      header: "Created",
      sortable: true,
      render: (row) => (
        <span className="text-fg-2">{formatDate(row.suppressedAt)}</span>
      ),
    },
  ];

  const actions: RowAction<SuppressionDashboardRow>[] = [
    {
      label: "Delete suppression",
      destructive: true,
      onClick: (row) => {
        setActionMessage("");
        setDeleteTarget(row);
      },
    },
  ];

  const createSuppression = useCallback(async () => {
    if (!newEmail.trim()) return;
    setSaving(true);
    setActionMessage("");
    try {
      const response = await fetch("/api/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), reason: newReason }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setActionMessage(payload?.error ?? "Failed to create suppression.");
        return;
      }
      setNewEmail("");
      setNewReason("manual");
      setCreateOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [newEmail, newReason, router]);

  const deleteSuppression = useCallback(async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setActionMessage("");
    try {
      const response = await fetch(
        `/api/suppressions/${encodeURIComponent(deleteTarget.email)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setActionMessage(payload?.error ?? "Failed to delete suppression.");
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [deleteTarget, router]);

  const importSuppressions = useCallback(async () => {
    const csv = buildCsvFromText(importCsv);
    if (!csv) return;
    setSaving(true);
    setActionMessage("");
    setImportResult(null);
    try {
      const response = await fetch("/api/suppressions/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv;charset=utf-8" },
        body: csv,
      });
      const payload = (await response.json()) as ImportResponse;
      setImportResult(payload);
      if (!response.ok) {
        setActionMessage("Fix the highlighted CSV rows and import again.");
        return;
      }
      setActionMessage("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [importCsv, router]);

  const clearFilters = useCallback(() => {
    setQuery("");
    setReason("all");
    setSource("all");
    setCreatedAfter("");
    setCreatedBefore("");
    setDomain("");
    setTopicId("");
    updateFilters({
      q: "",
      reason: "",
      source: "",
      created_after: "",
      created_before: "",
      domain: "",
      topic_id: "",
    });
  }, [updateFilters]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Suppressions</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-fg-2">
            Manage tenant-scoped addresses that OpenSend will not send to.
            Bounce and complaint rows should only be removed after consent and
            address health are confirmed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportStatusMessage state={exportState} />
          <button
            type="button"
            onClick={() => void exportCsv(exportParams)}
            disabled={exportState.type === "loading"}
            className="btn btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setActionMessage("");
              setImportResult(null);
              setImportOpen(true);
            }}
          >
            Import CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setActionMessage("");
              setCreateOpen(true);
            }}
          >
            Add suppression
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="suppression-search" className="sr-only">
          Search suppressions
        </label>
        <input
          id="suppression-search"
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            updateFilters({ q: value });
          }}
          placeholder="Search by email or source id"
          className="min-w-[280px] rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] text-fg focus:outline-none focus:ring-1 focus:ring-[rgba(176,199,217,0.3)]"
        />
        <select
          value={reason}
          onChange={(event) => {
            const value = event.target.value;
            setReason(value);
            updateFilters({ reason: value });
          }}
          className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] text-fg focus:outline-none"
        >
          <option value="all">All reasons</option>
          <option value="manual">Manual</option>
          <option value="bounced">Bounced</option>
          <option value="complained">Complained</option>
        </select>
        <select
          value={source}
          onChange={(event) => {
            const value = event.target.value;
            setSource(value);
            updateFilters({ source: value });
          }}
          className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] text-fg focus:outline-none"
        >
          <option value="all">All sources</option>
          <option value="manual">Manual</option>
          <option value="ses">SES</option>
          <option value="operator">Operator</option>
        </select>
        <label className="flex items-center gap-2 text-[12px] text-fg-2">
          From
          <input
            type="date"
            value={createdAfter}
            onChange={(event) => {
              const value = event.target.value;
              setCreatedAfter(value);
              updateFilters({ created_after: value });
            }}
            className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] text-fg focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-fg-2">
          To
          <input
            type="date"
            value={createdBefore}
            onChange={(event) => {
              const value = event.target.value;
              setCreatedBefore(value);
              updateFilters({ created_before: value });
            }}
            className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] text-fg focus:outline-none"
          />
        </label>
        <input
          type="text"
          value={domain}
          onChange={(event) => {
            const value = event.target.value;
            setDomain(value);
            updateFilters({ domain: value });
          }}
          placeholder="Source domain"
          className="w-[170px] rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] text-fg focus:outline-none"
        />
        <input
          type="text"
          value={topicId}
          onChange={(event) => {
            const value = event.target.value;
            setTopicId(value);
            updateFilters({ topic_id: value });
          }}
          placeholder="Source topic ID"
          className="w-[190px] rounded-md border border-line bg-bg-3 px-3 py-1.5 text-[13px] text-fg focus:outline-none"
        />
        {(query ||
          reason !== "all" ||
          source !== "all" ||
          createdAfter ||
          createdBefore ||
          domain ||
          topicId) && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[12px] text-fg-2 transition-colors hover:text-fg"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="mb-4 text-[12px] text-fg-3">
        Domain and topic filters apply only to suppressions that were created
        from a source email record. Manual imports do not carry domain/topic
        evidence in the current data model.
      </p>

      <div className="overflow-hidden rounded-lg border border-line">
        <DataTable
          columns={columns}
          rows={suppressions}
          getRowId={(row) => row.id}
          actions={actions}
          emptyMessage="No suppressions match these filters"
        />
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add suppression"
        actionLabel="Add suppression"
        onAction={createSuppression}
        actionDisabled={saving || !newEmail.trim()}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-fg-2">
            Suppressed recipients are blocked for this tenant until the row is
            deleted. Use this for known bounces, complaints, or manual safety
            holds.
          </p>
          <label className="block text-[13px] text-fg">
            Email
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg focus:outline-none"
              placeholder="recipient@example.com"
            />
          </label>
          <label className="block text-[13px] text-fg">
            Reason
            <select
              value={newReason}
              onChange={(event) =>
                setNewReason(event.target.value as SuppressionReason)
              }
              className="mt-1 w-full rounded-md border border-line bg-bg-3 px-3 py-2 text-[13px] text-fg focus:outline-none"
            >
              <option value="manual">Manual</option>
              <option value="bounced">Bounced</option>
              <option value="complained">Complained</option>
            </select>
          </label>
          {actionMessage && (
            <p className="text-[13px] text-red">{actionMessage}</p>
          )}
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import suppressions"
        actionLabel="Import CSV"
        onAction={importSuppressions}
        actionDisabled={saving || !importCsv.trim()}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-fg-2">
            Bounded import accepts up to 200 rows per request. CSV must include
            an <code className="font-mono">email</code> header and may include
            <code className="font-mono"> reason</code> values of manual,
            bounced, or complained. If any row is malformed, no rows are
            imported.
          </p>
          <textarea
            value={importCsv}
            onChange={(event) => setImportCsv(event.target.value)}
            rows={8}
            className="w-full rounded-md border border-line bg-bg-3 px-3 py-2 font-mono text-[13px] text-fg focus:outline-none"
            aria-label="Suppression CSV"
          />
          {actionMessage && (
            <p className="text-[13px] text-red">{actionMessage}</p>
          )}
          {importResult && importResult.errors.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-md border border-line bg-bg-2 p-3">
              <p className="mb-2 text-[12px] text-fg-2">
                {importResult.rejected_count} row error
                {importResult.rejected_count === 1 ? "" : "s"}:
              </p>
              <ul className="space-y-1 text-[12px] text-red">
                {importResult.errors.map((error) => (
                  <li key={`${error.row}-${error.field}-${error.message}`}>
                    Row {error.row || "file"} {error.field}: {error.message}
                    {error.value ? ` (${error.value})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {importResult && importResult.imported_count > 0 && (
            <p className="text-[13px] text-fg-2">
              Imported {importResult.imported_count} suppression row
              {importResult.imported_count === 1 ? "" : "s"}.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete suppression?"
        actionLabel="Delete suppression"
        actionVariant="destructive"
        onAction={deleteSuppression}
        actionDisabled={saving}
      >
        <div className="space-y-3">
          <p className="text-[13px] text-fg-2">
            This irreversible dashboard action removes the suppression for{" "}
            <span className="font-mono text-fg">{deleteTarget?.email}</span>.
            Future sends to this address can proceed unless another suppression
            or consent rule blocks them.
          </p>
          <p className="text-[13px] text-amber">
            Confirm you have evidence that the recipient can be mailed again.
          </p>
          {actionMessage && (
            <p className="text-[13px] text-red">{actionMessage}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
