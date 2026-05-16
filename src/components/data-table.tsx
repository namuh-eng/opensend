"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface RowAction<T> {
  label: string;
  onClick: (row: T) => void;
  separator?: boolean;
  destructive?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  checkboxEnabled?: boolean;
  onRowClick?: (row: T) => void;
  actions?: RowAction<T>[];
  emptyMessage?: string;
}

type SortDirection = "asc" | "desc";

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  checkboxEnabled = false,
  onRowClick,
  actions,
  emptyMessage = "No data",
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortState, setSortState] = useState<{
    key: string;
    direction: SortDirection;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(getRowId)));
    }
  }, [allSelected, rows, getRowId]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenuId]);

  const hasActions = actions && actions.length > 0;
  const totalCols =
    columns.length + (checkboxEnabled ? 1 : 0) + (hasActions ? 1 : 0);
  const displayRows = useMemo(() => {
    if (!sortState) return rows;

    const sorted = [...rows].sort((left, right) =>
      compareValues(
        (left as Record<string, unknown>)[sortState.key],
        (right as Record<string, unknown>)[sortState.key],
      ),
    );

    return sortState.direction === "desc" ? sorted.reverse() : sorted;
  }, [rows, sortState]);

  const toggleSort = useCallback((key: string) => {
    setSortState((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: "asc" };
      }

      return {
        key,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-line">
          {checkboxEnabled && (
            <th className="w-10 px-3 py-2 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-white rounded cursor-pointer"
                aria-label="Select all"
              />
            </th>
          )}
          {columns.map((col) => (
            <th
              key={col.key}
              className="px-3 py-2 text-left text-[12px] font-medium text-fg-2 tracking-normal"
              aria-sort={
                sortState?.key === col.key
                  ? sortState.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              {col.sortable ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 transition-colors hover:text-fg"
                  onClick={() => toggleSort(col.key)}
                >
                  {col.header}
                  <span aria-hidden="true" className="text-[10px]">
                    {sortState?.key === col.key
                      ? sortState.direction === "asc"
                        ? "↑"
                        : "↓"
                      : "↕"}
                  </span>
                </button>
              ) : (
                col.header
              )}
            </th>
          ))}
          {hasActions && <th className="w-10 px-3 py-2" />}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={totalCols}
              className="px-3 py-12 text-center text-[14px] text-fg-2"
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          displayRows.map((row) => {
            const id = getRowId(row);
            return (
              <tr
                key={id}
                className="border-b border-line hover:bg-bg-2 transition-colors"
              >
                {checkboxEnabled && (
                  <td className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(id)}
                      onChange={() => toggleRow(id)}
                      className="accent-white rounded cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 text-[14px] text-fg"
                    onClick={() => onRowClick?.(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onRowClick?.(row);
                    }}
                    style={onRowClick ? { cursor: "pointer" } : undefined}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
                {hasActions && (
                  <td className="w-10 px-3 py-2 relative">
                    <button
                      type="button"
                      aria-label="More actions"
                      className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === id ? null : id);
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <circle cx="12" cy="5" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {openMenuId === id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 top-full z-50 min-w-[180px] rounded-md border border-line bg-bg-2 py-1 shadow-lg"
                      >
                        {actions.map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-white/[0.14] transition-colors ${
                              action.destructive ? "text-red-400" : "text-fg"
                            } ${action.separator ? "border-t border-line mt-1 pt-1.5" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              action.onClick(row);
                              setOpenMenuId(null);
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
