"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Segment {
  id: string;
  name: string;
}

function isSegment(value: unknown): value is Segment {
  if (typeof value !== "object" || value === null) return false;

  const maybeSegment = value as Record<string, unknown>;
  return (
    typeof maybeSegment.id === "string" && typeof maybeSegment.name === "string"
  );
}

function extractSegments(payload: unknown): Segment[] {
  if (Array.isArray(payload)) {
    return payload.filter(isSegment);
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const maybeList = payload as Record<string, unknown>;
  return Array.isArray(maybeList.data) ? maybeList.data.filter(isSegment) : [];
}

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddContactModal({
  open,
  onClose,
  onSuccess,
}: AddContactModalProps) {
  const [emailText, setEmailText] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<Segment[]>([]);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [segmentDropdownOpen, setSegmentDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const segmentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const fetchSegments = useCallback(async () => {
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const authHeaders: Record<string, string> = {};
      if (apiKey) authHeaders.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/segments", { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setSegments(extractSegments(data));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSegments();
      setEmailText("");
      setSelectedSegments([]);
      setSegmentSearch("");
      setSubmitError(null);
    }
  }, [open, fetchSegments]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        segmentRef.current &&
        !segmentRef.current.contains(e.target as Node)
      ) {
        setSegmentDropdownOpen(false);
      }
    }
    if (segmentDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [segmentDropdownOpen]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (open) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const parseEmails = (text: string): string[] => {
    return text
      .split(/[,\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);
  };

  const filteredSegments = segments.filter(
    (s) =>
      s.name.toLowerCase().includes(segmentSearch.toLowerCase()) &&
      !selectedSegments.some((sel) => sel.id === s.id),
  );

  const addSegment = (segment: Segment) => {
    setSelectedSegments((prev) => [...prev, segment]);
    setSegmentSearch("");
    setSegmentDropdownOpen(false);
  };

  const removeSegment = (id: string) => {
    setSelectedSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    const emails = parseEmails(emailText);
    if (emails.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      for (const email of emails) {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers,
          body: JSON.stringify({
            email,
            segments: selectedSegments.map((s) => s.id),
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to add contact");
        }
      }

      onSuccess();
      onClose();
    } catch {
      setSubmitError(
        "Could not add contacts. Check the email address and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="w-full max-w-md bg-bg-card border border-line rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-[16px] font-semibold text-fg">Add contacts</h2>
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
          {/* Email textarea */}
          <div>
            <label
              htmlFor="add-contact-emails"
              className="block text-[13px] font-medium text-fg mb-1.5"
            >
              Email addresses
            </label>
            <textarea
              id="add-contact-emails"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="foo@gmail.com, bar@gmail.com"
              rows={4}
              className="w-full px-3 py-2 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 resize-none"
            />
            <p className="mt-1 text-[12px] text-fg-2">
              Use commas or line breaks to separate multiple email addresses.
            </p>
            {submitError && (
              <p className="mt-2 text-[12px] text-red-400" role="alert">
                {submitError}
              </p>
            )}
          </div>

          {/* Segments autocomplete */}
          <div>
            <label
              htmlFor="add-contact-segments"
              className="block text-[13px] font-medium text-fg mb-1.5"
            >
              Segments
            </label>
            <div ref={segmentRef} className="relative">
              {/* Selected segment tags */}
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {selectedSegments.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[12px] bg-white/10 border border-line rounded text-fg"
                  >
                    {s.name}
                    <button
                      type="button"
                      onClick={() => removeSegment(s.id)}
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
                ))}
              </div>

              <input
                id="add-contact-segments"
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

              {segmentDropdownOpen && filteredSegments.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-bg-2 border border-line rounded-md shadow-lg z-50">
                  {filteredSegments.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addSegment(s)}
                      className="w-full text-left px-3 py-2 text-[13px] text-fg hover:bg-white/10 transition-colors"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] font-medium text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-3 py-1.5 text-[13px] font-medium bg-white text-black rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
