"use client";

import { ComboboxFilter } from "@/components/combobox-filter";
import { DateRangePicker } from "@/components/date-range-picker";
import { DropdownFilter } from "@/components/dropdown-filter";
import type { DropdownFilterOption } from "@/components/dropdown-filter";
import { ExportButton } from "@/components/export-button";
import { SearchInput } from "@/components/search-input";
import { getDateRangeBounds, toIsoDate } from "@/lib/date-range";
import { useEffect, useRef, useState } from "react";

export interface EmailFilters {
  search: string;
  dateRange: string;
  status: string;
  apiKeyId: string;
}

interface EmailsSendingFilterBarProps {
  apiKeys: { id: string; name: string }[];
  initialFilters?: Partial<EmailFilters>;
  onFiltersChange: (filters: EmailFilters) => void;
}

function getFilters(initialFilters?: Partial<EmailFilters>): EmailFilters {
  return {
    search: initialFilters?.search ?? "",
    dateRange: initialFilters?.dateRange ?? "Last 15 days",
    status: initialFilters?.status ?? "",
    apiKeyId: initialFilters?.apiKeyId ?? "",
  };
}

const STATUS_OPTIONS: DropdownFilterOption[] = [
  { value: "", label: "All Statuses" },
  { value: "bounced", label: "Bounced", color: "#EF4444" },
  { value: "canceled", label: "Canceled", color: "#6B7280" },
  { value: "clicked", label: "Clicked", color: "#8B5CF6" },
  { value: "complained", label: "Complained", color: "#F97316" },
  { value: "delivered", label: "Delivered", color: "#22C55E" },
  { value: "delivery_delayed", label: "Delivery Delayed", color: "#EAB308" },
  { value: "failed", label: "Failed", color: "#EF4444" },
  { value: "opened", label: "Opened", color: "#3B82F6" },
  { value: "processing", label: "Processing", color: "#EAB308" },
  { value: "scheduled", label: "Scheduled", color: "#A1A4A5" },
  { value: "sent", label: "Sent", color: "#22C55E" },
  { value: "queued", label: "Queued", color: "#A1A4A5" },
  { value: "suppressed", label: "Suppressed", color: "#6B7280" },
];

const FAILURE_EXPORT_STATUSES = new Set([
  "bounced",
  "complained",
  "suppressed",
]);

type ExportState =
  | { type: "idle"; message: string }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "empty"; message: string }
  | { type: "error"; message: string };

function downloadCsv(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildFailureExportParams(filters: EmailFilters): URLSearchParams {
  const params = new URLSearchParams();
  const statuses = FAILURE_EXPORT_STATUSES.has(filters.status)
    ? filters.status
    : Array.from(FAILURE_EXPORT_STATUSES).join(",");
  const { start, end } = getDateRangeBounds(filters.dateRange);

  params.set("statuses", statuses);
  params.set("start_date", toIsoDate(start));
  params.set("end_date", toIsoDate(end));

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  return params;
}

export function EmailsSendingFilterBar({
  apiKeys,
  initialFilters,
  onFiltersChange,
}: EmailsSendingFilterBarProps) {
  const [filters, setFilters] = useState<EmailFilters>(
    getFilters(initialFilters),
  );
  const [exportState, setExportState] = useState<ExportState>({
    type: "idle",
    message: "",
  });
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
      searchTimeout.current = null;
    }

    setFilters(getFilters(initialFilters));
  }, [initialFilters]);

  const updateFilters = (
    overrides: Partial<EmailFilters>,
    options?: { debounceSearch?: boolean },
  ) => {
    setFilters((prev) => {
      const next = { ...prev, ...overrides };

      if (options?.debounceSearch) {
        if (searchTimeout.current) {
          clearTimeout(searchTimeout.current);
        }
        searchTimeout.current = setTimeout(() => {
          onFiltersChange(next);
        }, 300);
      } else {
        onFiltersChange(next);
      }

      return next;
    });
  };

  const handleSearchChange = (value: string) => {
    updateFilters({ search: value }, { debounceSearch: true });
  };

  const handleDateRangeChange = (value: string) => {
    updateFilters({ dateRange: value });
  };

  const handleStatusChange = (value: string) => {
    updateFilters({ status: value });
  };

  const handleApiKeyChange = (value: string) => {
    updateFilters({ apiKeyId: value });
  };

  const handleExport = () => {
    setExportState({
      type: "loading",
      message: "Preparing delivery failure export…",
    });

    const exportFailures = async () => {
      try {
        const params = buildFailureExportParams(filters);
        const response = await fetch(
          `/api/dashboard/delivery-failures/export?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error("Export request failed");
        }

        const rowCount = Number(
          response.headers.get("x-opensend-export-rows") ?? "0",
        );

        if (rowCount === 0) {
          setExportState({
            type: "empty",
            message:
              "No bounced, complained, or suppressed failures match these filters.",
          });
          return;
        }

        const blob = await response.blob();
        const timestamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`delivery-failures-${timestamp}.csv`, blob);
        setExportState({
          type: "success",
          message: `Exported ${rowCount} failure row${
            rowCount === 1 ? "" : "s"
          }.`,
        });
      } catch {
        setExportState({
          type: "error",
          message: "Delivery failure export failed. Please try again.",
        });
      }
    };

    void exportFailures();
  };

  const apiKeyOptions = [
    { value: "", label: "All API Keys" },
    ...apiKeys.map((k) => ({ value: k.id, label: k.name })),
  ];

  return (
    <div className="flex items-center gap-2 mt-4">
      <div className="w-[200px]">
        <SearchInput value={filters.search} onChange={handleSearchChange} />
      </div>
      <DateRangePicker
        value={filters.dateRange}
        onChange={handleDateRangeChange}
      />
      <DropdownFilter
        options={STATUS_OPTIONS}
        value={filters.status}
        onChange={handleStatusChange}
      />
      <ComboboxFilter
        options={apiKeyOptions}
        value={filters.apiKeyId}
        onChange={handleApiKeyChange}
      />
      <div className="ml-auto flex items-center gap-3">
        {exportState.message ? (
          <p
            className={`text-[12px] ${
              exportState.type === "error" ? "text-[#EF4444]" : "text-[#A1A4A5]"
            }`}
            role={exportState.type === "error" ? "alert" : "status"}
          >
            {exportState.message}
          </p>
        ) : null}
        <ExportButton onClick={handleExport} />
      </div>
    </div>
  );
}
