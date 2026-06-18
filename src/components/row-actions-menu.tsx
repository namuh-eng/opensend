"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface RowMenuAction {
  label: string;
  onSelect: () => void;
}

interface RowActionsMenuProps {
  /** Non-destructive menu items (e.g. Edit), rendered above the delete item. */
  actions?: RowMenuAction[];
  /** Optional destructive delete action with a confirm dialog. */
  deleteAction?: {
    label: string;
    /** Short confirmation sentence shown in the dialog. */
    confirmText: string;
    onConfirm: () => Promise<void>;
  };
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
}

/**
 * Reusable row "⋮ More actions" dropdown for audience list tables. Replaces
 * the previously dead trigger buttons that had no onClick handler.
 */
export function RowActionsMenu({
  actions = [],
  deleteAction,
  ariaLabel = "More actions",
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!confirming) return;
    cancelButtonRef.current?.focus();

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirming(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [confirming]);

  const handleConfirmDelete = async () => {
    if (!deleteAction) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAction.onConfirm();
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 data-[open=true]:opacity-100"
        data-open={open}
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

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-bg-2 border border-line rounded-md shadow-lg z-50 py-1">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] text-fg hover:bg-white/10 transition-colors"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
          {deleteAction && (
            <>
              {actions.length > 0 && (
                <div className="border-t border-line my-1" />
              )}
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[13px] text-red-400 hover:bg-white/10 transition-colors"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                  setConfirming(true);
                }}
              >
                {deleteAction.label}
              </button>
            </>
          )}
        </div>
      )}

      {confirming && deleteAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirming(false);
          }}
        >
          <dialog
            open
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-sm bg-bg-card border border-line rounded-lg shadow-xl p-6"
          >
            <h2
              id={dialogTitleId}
              className="text-[16px] font-semibold text-fg mb-2"
            >
              {deleteAction.label}
            </h2>
            <p className="text-[13px] text-fg-2 mb-4">
              {deleteAction.confirmText}
            </p>
            {error && (
              <p className="text-[12px] text-red-400 mb-3" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 text-[13px] font-medium text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-[13px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
