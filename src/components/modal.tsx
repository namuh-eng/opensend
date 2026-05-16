"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "default" | "destructive";
  actionDisabled?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  actionLabel,
  onAction,
  actionVariant = "default",
  actionDisabled = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose();
        }}
        role="button"
        tabIndex={-1}
        aria-label="Close modal"
      />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-[520px] rounded-lg border border-line bg-bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
            onClick={onClose}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="px-6 pb-4">{children}</div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          {actionLabel && onAction && (
            <button
              type="button"
              disabled={actionDisabled}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                actionVariant === "destructive"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-fg text-bg hover:bg-white"
              } ${actionDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-[13px] font-medium text-fg-2 border border-line hover:bg-white/[0.14] transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
