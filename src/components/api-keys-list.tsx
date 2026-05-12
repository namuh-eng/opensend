"use client";

import { DataTable } from "@/components/data-table";
import type { Column, RowAction } from "@/components/data-table";
import { DropdownFilter } from "@/components/dropdown-filter";
import { EmptyState } from "@/components/empty-state";
import { ExportButton } from "@/components/export-button";
import { Modal } from "@/components/modal";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export interface ApiKeyRow {
  id: string;
  name: string;
  tokenPreview: string;
  permission: "full_access" | "sending_access";
  lastUsedAt: string | null;
  createdAt: string;
}

interface DomainOption {
  id: string;
  name: string;
}

interface ApiKeysListProps {
  keys: ApiKeyRow[];
  domains: DomainOption[];
}

const PERMISSION_OPTIONS = [
  { value: "all", label: "All Permissions" },
  { value: "full_access", label: "Full access" },
  { value: "sending_access", label: "Sending access" },
];

function formatPermission(p: string): string {
  if (p === "full_access") return "Full access";
  if (p === "sending_access") return "Sending access";
  return p;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (diffDays > 0)
    return `about ${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  if (diffHours > 0)
    return `about ${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffMins > 0)
    return `about ${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  return "just now";
}

export function ApiKeysList({ keys, domains }: ApiKeysListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [permFilter, setPermFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPermission, setNewPermission] = useState<
    "full_access" | "sending_access"
  >("full_access");
  const [newDomainId, setNewDomainId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const { exportState, exportCsv } = useDashboardCsvExport("api-keys");

  // Filter keys
  const filtered = keys.filter((k) => {
    const matchesSearch =
      search === "" ||
      k.name.toLowerCase().includes(search.toLowerCase()) ||
      k.tokenPreview.toLowerCase().includes(search.toLowerCase());
    const matchesPerm = permFilter === "all" || k.permission === permFilter;
    return matchesSearch && matchesPerm;
  });

  // Paginate
  const totalItems = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const paginated = filtered.slice(startIdx, startIdx + pageSize);

  const columns: Column<ApiKeyRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <button
          type="button"
          className="text-[#F0F0F0] hover:underline text-left"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/api-keys/${row.id}`);
          }}
        >
          {row.name}
        </button>
      ),
    },
    {
      key: "tokenPreview",
      header: "Token",
      render: (row) => (
        <span className="font-mono text-[#A1A4A5] text-[13px]">
          {row.tokenPreview}
        </span>
      ),
    },
    {
      key: "permission",
      header: "Permission",
      render: (row) => formatPermission(row.permission),
    },
    {
      key: "lastUsedAt",
      header: "Last Used",
      render: (row) =>
        row.lastUsedAt ? formatRelativeTime(row.lastUsedAt) : "Never",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => formatRelativeTime(row.createdAt),
    },
  ];

  const actions: RowAction<ApiKeyRow>[] = [
    {
      label: "Delete",
      destructive: true,
      separator: true,
      onClick: async (row) => {
        try {
          await fetch(`/api/api-keys/${row.id}`, { method: "DELETE" });
          window.location.reload();
        } catch {
          // silently fail
        }
      },
    },
  ];

  const handlePermissionChange = useCallback(
    (value: "full_access" | "sending_access") => {
      setNewPermission(value);
      if (value === "full_access") {
        setNewDomainId("");
      }
    },
    [],
  );

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          permission: newPermission,
          domain_id: newDomainId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedToken(data.token);
      }
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }, [newName, newPermission, newDomainId, creating]);

  const handleExport = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (permFilter !== "all") params.set("permission", permFilter);
    void exportCsv(params);
  }, [exportCsv, permFilter, search]);

  if (keys.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[#F0F0F0]">API Keys</h1>
          <div className="flex items-center gap-3">
            <ExportStatusMessage state={exportState} />
            <ExportButton
              onClick={handleExport}
              disabled={exportState.type === "loading"}
            />
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium bg-white text-black hover:bg-gray-200 transition-colors"
              onClick={() => setCreateOpen(true)}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              Create API Key
            </button>
          </div>
        </div>
        <EmptyState
          title="No API keys yet"
          description="Create an API key to start sending emails programmatically."
          actionLabel="Create API Key"
          onAction={() => setCreateOpen(true)}
        />
        {renderCreateModal()}
      </div>
    );
  }

  function handleCloseCreateModal() {
    setCreateOpen(false);
    setNewName("");
    setNewPermission("full_access");
    setNewDomainId("");
    if (createdToken) {
      setCreatedToken(null);
      window.location.reload();
    }
  }

  function renderCreateModal() {
    // Token reveal view after successful creation
    if (createdToken) {
      return (
        <Modal
          open={createOpen}
          onClose={handleCloseCreateModal}
          title="API Key Created"
        >
          <div className="space-y-4">
            <p className="text-[13px] text-[#A1A4A5]">
              This key will never be shown again. Please copy it and store it
              securely.
            </p>
            <div className="bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-md py-3 px-4">
              <code className="text-[14px] text-[#F0F0F0] font-mono break-all">
                {createdToken}
              </code>
            </div>
          </div>
        </Modal>
      );
    }

    return (
      <Modal
        open={createOpen}
        onClose={handleCloseCreateModal}
        title="Add API Key"
        actionLabel="Add"
        onAction={handleCreate}
        actionDisabled={!newName.trim()}
      >
        <div className="space-y-4">
          <div>
            <label
              htmlFor="ak-name"
              className="block text-[13px] text-[#F0F0F0] mb-1.5"
            >
              Name
            </label>
            <input
              id="ak-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Your API Key name"
              className="w-full bg-transparent border border-[rgba(176,199,217,0.145)] rounded-md py-2 px-3 text-[14px] text-[#F0F0F0] placeholder-[#A1A4A5] outline-none focus:border-[rgba(176,199,217,0.3)] transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="ak-permission"
              className="block text-[13px] text-[#F0F0F0] mb-1.5"
            >
              Permission
            </label>
            <select
              id="ak-permission"
              value={newPermission}
              onChange={(e) =>
                handlePermissionChange(
                  e.target.value as "full_access" | "sending_access",
                )
              }
              className="w-full bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-md py-2 px-3 text-[14px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)] transition-colors appearance-none cursor-pointer"
            >
              <option value="full_access">Full access</option>
              <option value="sending_access">Sending access</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="ak-domain"
              className="block text-[13px] text-[#F0F0F0] mb-1.5"
            >
              Domain
            </label>
            <select
              id="ak-domain"
              value={newDomainId}
              onChange={(e) => setNewDomainId(e.target.value)}
              disabled={newPermission === "full_access"}
              className={`w-full bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-md py-2 px-3 text-[14px] text-[#F0F0F0] outline-none focus:border-[rgba(176,199,217,0.3)] transition-colors appearance-none cursor-pointer ${newPermission === "full_access" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <option value="">All Domains</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#F0F0F0]">API Keys</h1>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium bg-white text-black hover:bg-gray-200 transition-colors"
          onClick={() => setCreateOpen(true)}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
          Create API Key
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 max-w-[400px]">
          <SearchInput value={search} onChange={setSearch} />
        </div>
        <DropdownFilter
          options={PERMISSION_OPTIONS}
          value={permFilter}
          onChange={setPermFilter}
        />
        <ExportStatusMessage state={exportState} />
        <ExportButton
          onClick={handleExport}
          disabled={exportState.type === "loading"}
        />
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        rows={paginated}
        getRowId={(row) => row.id}
        checkboxEnabled
        actions={actions}
        onRowClick={(row) => router.push(`/api-keys/${row.id}`)}
        emptyMessage="No API keys match your filters"
      />

      {/* Pagination */}
      {totalItems > 0 && (
        <Pagination
          page={page}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {renderCreateModal()}
    </div>
  );
}
