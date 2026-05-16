"use client";

import { ComboboxFilter } from "@/components/combobox-filter";
import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { ExportButton } from "@/components/export-button";
import { Modal } from "@/components/modal";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface DomainListItem {
  id: string;
  name: string;
  status: string;
  region: string;
  createdAt: string;
}

interface DomainsPageProps {
  domains: DomainListItem[];
}

const REGION_DISPLAY: Record<string, string> = {
  "us-east-1": "North Virginia",
  "eu-west-1": "Ireland",
  "sa-east-1": "São Paulo",
  "ap-northeast-1": "Tokyo",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "failed", label: "Failed" },
  { value: "not_started", label: "Not Started" },
];

const REGION_OPTIONS = [
  { value: "", label: "All Regions" },
  { value: "us-east-1", label: "North Virginia (us-east-1)" },
  { value: "eu-west-1", label: "Ireland (eu-west-1)" },
  { value: "sa-east-1", label: "São Paulo (sa-east-1)" },
  { value: "ap-northeast-1", label: "Tokyo (ap-northeast-1)" },
];

const ITEMS_PER_PAGE_OPTIONS = [40, 80, 120];

function getDomainStatusVariant(
  status: string,
): "success" | "error" | "warning" | "info" | "default" {
  switch (status) {
    case "verified":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "error";
    default:
      return "default";
  }
}

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatRegionDisplay(region: string): string {
  const friendly = REGION_DISPLAY[region] || region;
  return `${friendly} ${region}`;
}

export function DomainsPage({ domains }: DomainsPageProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [trackingSubdomain, setTrackingSubdomain] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adding, setAdding] = useState(false);
  const [regionFilter, setRegionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(40);
  const { exportState, exportCsv } = useDashboardCsvExport("domains");

  const filteredDomains = useMemo(() => {
    let result = domains;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }
    if (statusFilter) {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (regionFilter) {
      result = result.filter((d) => d.region === regionFilter);
    }
    return result;
  }, [domains, search, statusFilter, regionFilter]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (regionFilter) params.set("region", regionFilter);
    void exportCsv(params);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDomains.length / itemsPerPage),
  );
  const paginatedDomains = filteredDomains.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-fg">Domains</h1>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-white text-black text-[13px] font-medium rounded-lg hover:bg-white/[0.12] transition-colors"
        >
          Add domain
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-4">
        <SearchInput value={search} onChange={setSearch} />
        <ComboboxFilter
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
        />
        <ComboboxFilter
          options={REGION_OPTIONS}
          value={regionFilter}
          onChange={(val) => {
            setRegionFilter(val);
            setPage(1);
          }}
        />
        <div className="ml-auto flex items-center gap-3">
          <ExportStatusMessage state={exportState} />
          <ExportButton
            onClick={handleExport}
            disabled={exportState.type === "loading"}
          />
        </div>
      </div>

      {/* Data Table */}
      {paginatedDomains.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          No domains found
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-line">
              <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                Domain
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                Status
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                Region
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal">
                Created
              </th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {paginatedDomains.map((domain) => (
              <DomainRow key={domain.id} domain={domain} />
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {filteredDomains.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-[13px] text-fg-2">
          <span>
            {(page - 1) * itemsPerPage + 1}–
            {Math.min(page * itemsPerPage, filteredDomains.length)} of{" "}
            {filteredDomains.length}
          </span>
          <div className="flex items-center gap-3">
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="bg-bg-3 border border-line rounded-lg px-2 py-1 text-fg-2 text-[13px]"
            >
              {ITEMS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 rounded border border-line disabled:opacity-30"
            >
              ←
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-line disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>
      )}
      {/* Add Domain Modal */}
      {showAddModal && (
        <Modal
          open={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setNewDomain("");
            setTrackingSubdomain("");
            setShowAdvanced(false);
          }}
          title="Add domain"
          actionLabel={adding ? "Adding..." : "Add"}
          actionDisabled={!newDomain.trim() || adding}
          onAction={async () => {
            setAdding(true);
            try {
              const res = await fetch("/api/domains", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: newDomain.trim(),
                  ...(trackingSubdomain.trim()
                    ? { tracking_subdomain: trackingSubdomain.trim() }
                    : {}),
                }),
              });
              if (res.ok) {
                const data = await res.json();
                setShowAddModal(false);
                setNewDomain("");
                setTrackingSubdomain("");
                setShowAdvanced(false);
                router.push(`/domains/${data.id}`);
                router.refresh();
              }
            } finally {
              setAdding(false);
            }
          }}
        >
          <p className="text-[13px] text-fg-2 mb-4">
            Enter the domain you want to verify for sending emails.
          </p>
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="yourdomain.com"
            className="w-full px-3 py-2 bg-bg-3 border border-line rounded-lg text-fg text-[14px] placeholder:text-fg-4 focus:outline-none focus:border-[#3b82f6]"
          />
          <button
            type="button"
            className="mt-4 text-[13px] text-blue-400 hover:text-blue-300"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced ? "Hide advanced options" : "Advanced options"}
          </button>
          {showAdvanced && (
            <div className="mt-3 rounded-lg border border-line bg-bg-card p-3">
              <label
                htmlFor="tracking-subdomain"
                className="block text-[13px] font-medium text-fg mb-1"
              >
                Custom tracking subdomain
              </label>
              <p className="text-[12px] text-fg-2 mb-2">
                Optional. OpenSend will add a CNAME like{" "}
                <span className="font-mono text-fg">links.yourdomain.com</span>{" "}
                so tracked clicks and opens can use your branded domain.
              </p>
              <input
                id="tracking-subdomain"
                type="text"
                value={trackingSubdomain}
                onChange={(e) => setTrackingSubdomain(e.target.value)}
                placeholder="links"
                className="w-full px-3 py-2 bg-bg-3 border border-line rounded-lg text-fg text-[14px] placeholder:text-fg-4 focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function DomainRow({ domain }: { domain: DomainListItem }) {
  return (
    <tr className="border-b border-line hover:bg-bg-2 transition-colors">
      <td className="px-3 py-2 text-[14px] text-fg">
        <Link
          href={`/domains/${domain.id}`}
          className="text-fg hover:underline"
        >
          {domain.name}
        </Link>
      </td>
      <td className="px-3 py-2">
        <StatusBadge
          status={formatStatusLabel(domain.status)}
          variant={getDomainStatusVariant(domain.status)}
        />
      </td>
      <td className="px-3 py-2 text-[14px] text-fg-2">
        {formatRegionDisplay(domain.region)}
      </td>
      <td
        className="px-3 py-2 text-[14px] text-fg-2"
        title={new Date(domain.createdAt).toLocaleString()}
      >
        {formatRelativeTime(domain.createdAt)}
      </td>
      <td className="w-10 px-3 py-2 relative">
        <button
          type="button"
          aria-label="More actions"
          className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
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
  );
}
