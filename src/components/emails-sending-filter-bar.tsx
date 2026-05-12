"use client";

import { ComboboxFilter } from "@/components/combobox-filter";
import { DateRangePicker } from "@/components/date-range-picker";
import { DropdownFilter } from "@/components/dropdown-filter";
import type { DropdownFilterOption } from "@/components/dropdown-filter";
import { ExportButton } from "@/components/export-button";
import { SearchInput } from "@/components/search-input";
import {
  ExportStatusMessage,
  useDashboardCsvExport,
} from "@/components/use-dashboard-csv-export";
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

function buildEmailExportParams(filters: EmailFilters): URLSearchParams {
  const params = new URLSearchParams();
  const { start, end } = getDateRangeBounds(filters.dateRange);

  params.set("start_date", toIsoDate(start));
  params.set("end_date", toIsoDate(end));

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.apiKeyId) {
    params.set("apiKeyId", filters.apiKeyId);
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
  const { exportState, exportCsv } = useDashboardCsvExport("emails");
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
    void exportCsv(buildEmailExportParams(filters));
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
        <ExportStatusMessage state={exportState} />
        <ExportButton
          onClick={handleExport}
          disabled={exportState.type === "loading"}
        />
      </div>
    </div>
  );
}
