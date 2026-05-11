"use client";

import { Modal } from "@/components/modal";
import { useState } from "react";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  apiKeys?: { id: string; name: string }[];
}

const STATUS_OPTIONS = [
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Complained" },
  { value: "suppressed", label: "Suppressed" },
] as const;

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(),
  );
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const toggleStatus = (value: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("start_date", dateFrom);
      if (dateTo) params.set("end_date", dateTo);
      if (selectedStatuses.size > 0) {
        params.set("statuses", Array.from(selectedStatuses).join(","));
      }

      const res = await fetch(
        `/api/dashboard/delivery-failures/export?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error("Failed to export delivery failures");
      }

      const rowCount = Number(res.headers.get("x-opensend-export-rows") ?? "0");
      if (rowCount === 0) {
        setMessage(
          "No bounced, complained, or suppressed failures match these filters.",
        );
        return;
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`delivery-failures-${timestamp}.csv`, await res.text());
      onClose();
    } catch {
      setMessage("Delivery failure export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export Delivery Failures"
      actionLabel={exporting ? "Exporting..." : "Export CSV"}
      onAction={handleExport}
      actionDisabled={exporting}
    >
      <div className="space-y-4">
        {message ? (
          <output className="block text-[13px] text-[#A1A4A5]">
            {message}
          </output>
        ) : null}
        {/* Date Range */}
        <div>
          <span className="block text-[12px] font-medium text-[#A1A4A5] tracking-wider mb-2">
            DATE RANGE
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-1.5 text-[13px] text-[#F0F0F0] bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-[8px] outline-none focus:border-[rgba(176,199,217,0.3)]"
              aria-label="Date from"
            />
            <span className="text-[13px] text-[#A1A4A5]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-1.5 text-[13px] text-[#F0F0F0] bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-[8px] outline-none focus:border-[rgba(176,199,217,0.3)]"
              aria-label="Date to"
            />
          </div>
        </div>

        {/* Status Multi-select */}
        <div>
          <span className="block text-[12px] font-medium text-[#A1A4A5] tracking-wider mb-2">
            STATUS
          </span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = selectedStatuses.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleStatus(opt.value)}
                  className={`px-2.5 py-1 text-[12px] rounded-full border transition-colors ${
                    isSelected
                      ? "bg-white text-black border-white"
                      : "text-[#A1A4A5] border-[rgba(176,199,217,0.145)] hover:text-[#F0F0F0] hover:border-[rgba(176,199,217,0.3)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
