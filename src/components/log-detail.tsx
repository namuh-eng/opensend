"use client";

import { CopyToClipboard } from "@/components/copy-to-clipboard";
import { StatusBadge } from "@/components/status-badge";
import Link from "next/link";

interface LogDetailData {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number | null;
  apiKeyId: string | null;
  userAgent: string | null;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
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
  const year = d.getFullYear();
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const seconds = d.getSeconds().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${month} ${day}, ${year} ${h}:${minutes}:${seconds} ${ampm}`;
}

export function LogDetail({ log }: { log: LogDetailData }) {
  return (
    <div>
      {/* Back link */}
      <Link
        href="/logs"
        className="inline-flex items-center gap-1 text-[13px] text-[#A1A4A5] hover:text-[#F0F0F0] transition-colors mb-6"
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Logs
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] flex items-center justify-center shrink-0">
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.5"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[#A1A4A5] mb-0.5">Log</p>
          <h1 className="text-[22px] font-semibold text-[#F0F0F0] truncate font-mono">
            {log.method.toUpperCase()} {log.path}
          </h1>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            ENDPOINT
          </p>
          <p className="text-[14px] text-[#F0F0F0] font-mono">{log.path}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            DATE
          </p>
          <p className="text-[14px] text-[#F0F0F0]">
            {formatDate(log.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            STATUS
          </p>
          <StatusBadge
            status={String(log.statusCode)}
            variant={getStatusVariant(log.statusCode)}
          />
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            METHOD
          </p>
          <StatusBadge
            status={log.method.toUpperCase()}
            variant={getMethodVariant(log.method)}
          />
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            DURATION
          </p>
          <p className="text-[14px] text-[#F0F0F0]">
            {log.duration != null ? `${log.duration}ms` : "-"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            API KEY
          </p>
          <p className="text-[14px] text-[#F0F0F0] font-mono">
            {log.apiKeyId ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            USER AGENT
          </p>
          <p className="text-[14px] text-[#F0F0F0] font-mono break-all">
            {log.userAgent ?? "-"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-1">
            ID
          </p>
          <CopyToClipboard value={log.id} />
        </div>
      </div>

      {/* Request Body */}
      <div className="mb-6">
        <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-3">
          REQUEST BODY
        </p>
        <div className="bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-lg p-4 overflow-x-auto">
          <pre className="text-[13px] text-[#F0F0F0] font-mono whitespace-pre-wrap">
            {log.requestBody
              ? JSON.stringify(log.requestBody, null, 2)
              : "No request body"}
          </pre>
        </div>
      </div>

      {/* Response Body */}
      <div className="mb-6">
        <p className="text-[11px] font-medium text-[#A1A4A5] tracking-wider mb-3">
          RESPONSE BODY
        </p>
        <div className="bg-[rgba(24,25,28,0.88)] border border-[rgba(176,199,217,0.145)] rounded-lg p-4 overflow-x-auto">
          <pre className="text-[13px] text-[#F0F0F0] font-mono whitespace-pre-wrap">
            {log.responseBody
              ? JSON.stringify(log.responseBody, null, 2)
              : "No response body"}
          </pre>
        </div>
      </div>
    </div>
  );
}
