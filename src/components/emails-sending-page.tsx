"use client";

import { EmailsHeader } from "@/components/emails-header";
import {
  type EmailListItem,
  EmailsSendingDataTable,
} from "@/components/emails-sending-data-table";
import {
  type EmailFilters,
  EmailsSendingFilterBar,
} from "@/components/emails-sending-filter-bar";
import {
  getDateRangeBounds,
  isCustomDateRange,
  parseCustomDateRange,
} from "@/lib/date-range";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface EmailsSendingPageProps {
  apiKeys: { id: string; name: string }[];
  emails: EmailListItem[];
  hasAnyEmails?: boolean;
}

function parseInitialFilters(searchParams: URLSearchParams): EmailFilters {
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const status =
    searchParams.get("status") ?? searchParams.get("statuses") ?? "";

  return {
    search: searchParams.get("search") ?? "",
    dateRange:
      startDate && endDate
        ? `custom:${startDate}:${endDate}`
        : (searchParams.get("dateRange") ?? "Last 15 days"),
    status: status === "all" ? "" : status,
    apiKeyId:
      searchParams.get("apiKeyId") ?? searchParams.get("api_key_id") ?? "",
  };
}

function buildQueryString(filters: EmailFilters): string {
  const params = new URLSearchParams();

  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.apiKeyId) {
    params.set("apiKeyId", filters.apiKeyId);
  }

  if (isCustomDateRange(filters.dateRange)) {
    const customRange = parseCustomDateRange(filters.dateRange);
    if (customRange) {
      params.set("startDate", customRange.startDate);
      params.set("endDate", customRange.endDate);
    }
  } else if (filters.dateRange !== "Last 15 days") {
    params.set("dateRange", filters.dateRange);
  }

  return params.toString();
}

function hasActiveFilters(filters: EmailFilters): boolean {
  return Boolean(
    filters.search ||
      filters.status ||
      filters.apiKeyId ||
      filters.dateRange !== "Last 15 days",
  );
}

export function EmailsSendingPage({
  apiKeys,
  emails,
  hasAnyEmails = emails.length > 0,
}: EmailsSendingPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialFilters = useMemo(
    () => parseInitialFilters(searchParams),
    [searchParams],
  );
  const [filters, setFilters] = useState<EmailFilters>(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    const nextQuery = buildQueryString(filters);
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl);
  }, [filters, pathname, router]);

  const filteredEmails = useMemo(() => {
    let result = emails;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.to.some((t) => t.toLowerCase().includes(q)) ||
          e.subject.toLowerCase().includes(q),
      );
    }
    if (filters.status) {
      result = result.filter((e) => e.lastEvent === filters.status);
    }
    const { start, end } = getDateRangeBounds(filters.dateRange);
    result = result.filter((e) => {
      const createdAt = new Date(e.createdAt);
      return createdAt >= start && createdAt <= end;
    });
    return result;
  }, [emails, filters.dateRange, filters.search, filters.status]);

  return (
    <div>
      <EmailsHeader activeTab="sending" apiKeys={apiKeys} />
      <EmailsSendingFilterBar
        apiKeys={apiKeys}
        initialFilters={initialFilters}
        onFiltersChange={setFilters}
      />
      <div className="mt-4">
        <EmailsSendingDataTable
          emails={filteredEmails}
          emptyState={
            hasAnyEmails || hasActiveFilters(filters) ? "filtered" : "first-run"
          }
        />
      </div>
    </div>
  );
}
