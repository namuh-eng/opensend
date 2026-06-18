"use client";

import {
  KNOWN_FIELD_KEYS,
  SKIP_SENTINEL,
  buildMapping,
  parseCsvHeaders,
} from "@/lib/csv-import";
import { useCallback, useEffect, useRef, useState } from "react";

interface Segment {
  id: string;
  name: string;
}

function isSegment(value: unknown): value is Segment {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.id === "string" && typeof m.name === "string";
}

function extractSegments(payload: unknown): Segment[] {
  if (Array.isArray(payload)) return payload.filter(isSegment);
  if (typeof payload !== "object" || payload === null) return [];
  const m = payload as Record<string, unknown>;
  return Array.isArray(m.data) ? m.data.filter(isSegment) : [];
}

interface PropertyOption {
  key: string;
  name: string;
}

function isProperty(value: unknown): value is PropertyOption {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.key === "string" && typeof m.name === "string";
}

function extractProperties(payload: unknown): PropertyOption[] {
  if (Array.isArray(payload)) return payload.filter(isProperty);
  if (typeof payload !== "object" || payload === null) return [];
  const m = payload as Record<string, unknown>;
  return Array.isArray(m.data) ? m.data.filter(isProperty) : [];
}

const CONTACT_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "pick" | "map" | "success";

export function ImportCsvModal({
  open,
  onClose,
  onSuccess,
}: ImportCsvModalProps) {
  const [step, setStep] = useState<Step>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [segmentDropdownOpen, setSegmentDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState<number>(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const segmentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSegments = useCallback(async () => {
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {};
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/segments", { headers });
      if (res.ok) {
        const data = await res.json();
        setSegments(extractSegments(data));
      }
    } catch {
      // ignore — segment picker is optional
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    try {
      // Same-origin: the dashboard session cookie authenticates the request.
      const res = await fetch("/api/properties");
      if (res.ok) {
        const data = await res.json();
        setProperties(extractProperties(data));
      }
    } catch {
      // ignore — custom-property options are optional
    }
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("pick");
      setFile(null);
      setHeaders([]);
      setAssignments({});
      setFileError(null);
      setSubmitError(null);
      setSelectedSegment(null);
      setSegmentSearch("");
      setCreatedCount(0);
      fetchSegments();
      fetchProperties();
    }
  }, [open, fetchSegments, fetchProperties]);

  // Escape to close
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Click-outside for segment dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        segmentRef.current &&
        !segmentRef.current.contains(e.target as Node)
      ) {
        setSegmentDropdownOpen(false);
      }
    }
    if (segmentDropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [segmentDropdownOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;

    setFileError(null);

    // Size check
    if (picked.size > CONTACT_IMPORT_MAX_BYTES) {
      setFileError("File exceeds 10 MB limit. Please choose a smaller file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Type check
    const mime = picked.type?.toLowerCase().split(";")[0]?.trim() ?? "";
    const hasCsvExt = picked.name.toLowerCase().endsWith(".csv");
    if (mime && !ALLOWED_MIME.has(mime) && !hasCsvExt) {
      setFileError("Unsupported file type. Please upload a .csv file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const cols = await parseCsvHeaders(picked);
      if (cols.length === 0) {
        setFileError(
          "Could not detect any column headers. Check that the file is not empty.",
        );
        return;
      }
      setFile(picked);
      setHeaders(cols);
      // Pre-assign columns whose names match a known field or a defined
      // custom property key; everything else defaults to skip.
      const autoAssign: Record<string, string> = {};
      for (const col of cols) {
        const lower = col.toLowerCase();
        const known = KNOWN_FIELD_KEYS.find((k) => k === lower);
        const prop = properties.find((p) => p.key.toLowerCase() === lower);
        autoAssign[col] = known ?? prop?.key ?? SKIP_SENTINEL;
      }
      setAssignments(autoAssign);
      setStep("map");
    } catch {
      setFileError("Failed to read the CSV file. Please try again.");
    }
  };

  const emailMapped = Object.values(assignments).includes("email");

  const handleSubmit = async () => {
    if (!file) return;

    let mapping: Record<string, string>;
    try {
      mapping = buildMapping(assignments);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Invalid column mapping.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      if (selectedSegment) {
        formData.append("segment_id", selectedSegment.id);
      }

      // Same-origin request: the browser sends the dashboard session cookie
      // automatically, so no Authorization header is needed.
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const result = (await res.json()) as { created_count?: number };
      setCreatedCount(result.created_count ?? 0);
      setStep("success");
      onSuccess();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Import failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSegments = segments.filter(
    (s) =>
      s.name.toLowerCase().includes(segmentSearch.toLowerCase()) &&
      s.id !== selectedSegment?.id,
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      onKeyDown={() => {}}
    >
      <div className="w-full max-w-lg bg-bg-card border border-line rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-[16px] font-semibold text-fg">Import CSV</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Step: pick file */}
          {step === "pick" && (
            <div>
              <label
                htmlFor="csv-file-input"
                className="block text-[13px] font-medium text-fg mb-1.5"
              >
                CSV file
              </label>
              <input
                id="csv-file-input"
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,application/csv,application/vnd.ms-excel"
                onChange={handleFileChange}
                className="w-full text-[13px] text-fg file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-line file:bg-transparent file:text-[13px] file:text-fg-2 file:cursor-pointer hover:file:text-fg file:transition-colors"
              />
              <p className="mt-1.5 text-[12px] text-fg-2">
                Max 10 MB. The first row must contain column headers.
              </p>
              {fileError && (
                <p className="mt-2 text-[12px] text-red-400" role="alert">
                  {fileError}
                </p>
              )}
            </div>
          )}

          {/* Step: map columns */}
          {step === "map" && (
            <>
              <div>
                <p className="text-[13px] text-fg-2 mb-3">
                  Map CSV columns to contact fields. At least one column must be
                  mapped to{" "}
                  <span className="font-medium text-fg">Email address</span>.
                </p>
                <div className="space-y-2">
                  {headers.map((col) => (
                    <div
                      key={col}
                      className="flex items-center gap-3 text-[13px]"
                    >
                      <span className="w-1/2 truncate text-fg font-mono text-[12px] px-2 py-1.5 bg-white/5 border border-line rounded">
                        {col}
                      </span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-fg-2 shrink-0"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                        <path d="M12 19l7-7-7-7" />
                      </svg>
                      <select
                        aria-label={`Map column ${col} to contact field`}
                        value={assignments[col] ?? SKIP_SENTINEL}
                        onChange={(e) =>
                          setAssignments((prev) => ({
                            ...prev,
                            [col]: e.target.value,
                          }))
                        }
                        className="w-1/2 h-8 px-2 text-[13px] bg-transparent border border-line rounded text-fg outline-none focus:border-line-3"
                      >
                        <option value={SKIP_SENTINEL}>— skip —</option>
                        <option value="email">Email address</option>
                        <option value="first_name">First name</option>
                        <option value="last_name">Last name</option>
                        {properties.length > 0 && (
                          <optgroup label="Custom properties">
                            {properties.map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {!KNOWN_FIELD_KEYS.includes(
                          col.toLowerCase() as (typeof KNOWN_FIELD_KEYS)[number],
                        ) &&
                          !properties.some((p) => p.key === col) && (
                            <option value={col}>New property: “{col}”</option>
                          )}
                      </select>
                    </div>
                  ))}
                </div>
                {!emailMapped && (
                  <p className="mt-2 text-[12px] text-amber-400">
                    Map one column to Email address to enable import.
                  </p>
                )}
              </div>

              {/* Segment (optional) */}
              <div>
                <label
                  htmlFor="import-csv-segment-search"
                  className="block text-[13px] font-medium text-fg mb-1.5"
                >
                  Add to segment{" "}
                  <span className="font-normal text-fg-2">(optional)</span>
                </label>
                <div ref={segmentRef} className="relative">
                  {selectedSegment && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] bg-white/10 border border-line rounded text-fg">
                        {selectedSegment.name}
                        <button
                          type="button"
                          onClick={() => setSelectedSegment(null)}
                          className="text-fg-2 hover:text-fg"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path d="M18 6L6 18" />
                            <path d="M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  )}
                  {!selectedSegment && (
                    <input
                      id="import-csv-segment-search"
                      type="text"
                      value={segmentSearch}
                      onChange={(e) => {
                        setSegmentSearch(e.target.value);
                        setSegmentDropdownOpen(true);
                      }}
                      onFocus={() => setSegmentDropdownOpen(true)}
                      placeholder="Search segments..."
                      className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
                    />
                  )}
                  {segmentDropdownOpen && filteredSegments.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-bg-2 border border-line rounded-md shadow-lg z-50">
                      {filteredSegments.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSegment(s);
                            setSegmentSearch("");
                            setSegmentDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-[13px] text-fg hover:bg-white/10 transition-colors"
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {submitError && (
                <p className="text-[12px] text-red-400" role="alert">
                  {submitError}
                </p>
              )}

              <p className="text-[12px] text-fg-2">
                File: <span className="font-medium text-fg">{file?.name}</span>
                {file && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep("pick");
                      setFile(null);
                      setHeaders([]);
                      setAssignments({});
                      setFileError(null);
                      setSubmitError(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ml-2 text-fg-2 underline hover:text-fg transition-colors"
                  >
                    Change
                  </button>
                )}
              </p>
            </>
          )}

          {/* Step: success */}
          {step === "success" && (
            <div className="py-4 text-center space-y-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto text-green-400"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p className="text-[15px] font-semibold text-fg">
                Import complete
              </p>
              <p className="text-[13px] text-fg-2">
                Imported{" "}
                <span className="font-medium text-fg">{createdCount}</span>{" "}
                contact{createdCount !== 1 ? "s" : ""}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line">
          {step === "success" ? (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary btn-sm"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[13px] font-medium text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors"
              >
                Cancel
              </button>
              {step === "map" && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !emailMapped}
                  className="btn btn-primary btn-sm disabled:opacity-50"
                >
                  {submitting ? "Importing..." : "Import"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
