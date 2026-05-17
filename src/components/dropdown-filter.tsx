"use client";

import { useEffect, useRef, useState } from "react";

export interface DropdownFilterOption {
  value: string;
  label: string;
  color?: string;
}

interface DropdownFilterProps {
  options: DropdownFilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export function DropdownFilter({
  options,
  value,
  onChange,
}: DropdownFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-fg bg-bg-3 border border-line rounded-[12px] hover:border-line-3 transition-colors"
      >
        {selectedLabel}
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-[12px] border border-line bg-bg-3 py-1 shadow-lg backdrop-blur-sm">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-white/[0.14] transition-colors"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.color && (
                <span
                  data-testid="color-dot"
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              <span className="flex-1 text-left">{opt.label}</span>
              {opt.value === value && (
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-fg flex-shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
