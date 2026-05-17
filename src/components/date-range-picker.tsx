"use client";

import {
  DATE_RANGE_PRESETS,
  formatDateRangeLabel,
  getDateRangeBounds,
  parseCustomDateRange,
  parseIsoDate,
  serializeCustomDateRange,
  toIsoDate,
} from "@/lib/date-range";
import { useEffect, useRef, useState } from "react";

const DAY_HEADERS = [
  { key: "sun", label: "S" },
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
];

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [pendingRangeStart, setPendingRangeStart] = useState<string | null>(
    null,
  );
  const ref = useRef<HTMLDivElement>(null);

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

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  // Build calendar grid with stable keys
  const cells: { key: string; day: number | null }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ key: `pad-${i}`, day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: `day-${d}`, day: d });
  }

  // Determine which days are "selected" based on preset
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const isInRange = (day: number): boolean => {
    const date = new Date(year, month, day);
    const { start, end } = getDateRangeBounds(value, today);
    return date >= start && date <= end;
  };

  const isPendingRangeStart = (day: number): boolean => {
    if (!pendingRangeStart) {
      return false;
    }

    return pendingRangeStart === toIsoDate(new Date(year, month, day));
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);
    const clickedIso = toIsoDate(clickedDate);

    if (!pendingRangeStart) {
      setPendingRangeStart(clickedIso);
      return;
    }

    const start =
      parseIsoDate(pendingRangeStart) <= clickedDate
        ? parseIsoDate(pendingRangeStart)
        : clickedDate;
    const end =
      parseIsoDate(pendingRangeStart) <= clickedDate
        ? clickedDate
        : parseIsoDate(pendingRangeStart);

    onChange(serializeCustomDateRange(start, end));
    setPendingRangeStart(null);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-fg bg-bg-3 border border-line rounded-[12px] hover:border-line-3 transition-colors"
      >
        {formatDateRangeLabel(value)}
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
        <div className="absolute left-0 top-full mt-1 z-50 rounded-[12px] border border-line bg-bg-3 shadow-lg backdrop-blur-sm flex">
          {/* Presets */}
          <div className="py-1 border-r border-line min-w-[140px]">
            {DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-fg hover:bg-white/[0.14] transition-colors"
                onClick={() => {
                  onChange(preset);
                  setPendingRangeStart(null);
                  setOpen(false);
                }}
              >
                <span className="flex-1 text-left">{preset}</span>
                {preset === value && (
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
          {/* Calendar */}
          <div className="p-3 min-w-[240px]">
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={prevMonth}
                className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-[13px] text-fg font-medium">
                {monthName}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={nextMonth}
                className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 mb-1">
              {DAY_HEADERS.map((d) => (
                <div
                  key={d.key}
                  className="text-center text-[11px] text-fg-2 py-1"
                >
                  {d.label}
                </div>
              ))}
            </div>
            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0">
              {cells.map((cell) => {
                if (cell.day === null) {
                  return <div key={cell.key} className="py-1" />;
                }
                const day = cell.day;
                const inRange = isInRange(day);
                const isToday =
                  day === todayDate &&
                  month === todayMonth &&
                  year === todayYear;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={`text-center text-[12px] py-1 cursor-pointer rounded transition-colors ${
                      inRange
                        ? "bg-white/20 text-fg"
                        : "text-fg-2 hover:bg-white/10"
                    } ${isPendingRangeStart(day) ? "ring-1 ring-[#F0F0F0]" : ""} ${isToday ? "font-bold" : ""}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
