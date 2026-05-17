"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [40, 80, 120];

export function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div className="flex items-center justify-between px-3 py-2 text-[13px] text-fg-2">
      <span>
        Page {page} &ndash; {start} of {totalItems}{" "}
        {totalItems === 1 ? "item" : "items"}
      </span>
      <div className="flex items-center gap-2">
        <div className="relative" ref={ref}>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-line hover:bg-bg-2 transition-colors"
            onClick={() => setOpen(!open)}
          >
            {pageSize} items
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          {open && (
            <div className="absolute bottom-full mb-1 right-0 z-50 min-w-[120px] rounded-md border border-line bg-bg-3 py-1 shadow-lg">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-white/[0.14] transition-colors ${
                    size === pageSize ? "text-fg" : "text-fg-2"
                  }`}
                  onClick={() => {
                    onPageSizeChange(size);
                    setOpen(false);
                  }}
                >
                  {size} items
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          className="p-1 rounded hover:bg-white/[0.14] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          onClick={() => onPageChange(page - 1)}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          className="p-1 rounded hover:bg-white/[0.14] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          onClick={() => onPageChange(page + 1)}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
