"use client";

import { useEffect, useId, useRef, useState } from "react";

interface EditContactModalProps {
  open: boolean;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    status: "subscribed" | "unsubscribed";
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function EditContactModal({
  open,
  contact,
  onClose,
  onSuccess,
}: EditContactModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const dialogTitleId = useId();

  // Seed the form from the contact whenever the modal opens.
  useEffect(() => {
    if (open) {
      setFirstName(contact.firstName ?? "");
      setLastName(contact.lastName ?? "");
      setUnsubscribed(contact.status === "unsubscribed");
      setSubmitError(null);
      queueMicrotask(() => firstNameInputRef.current?.focus());
    }
  }, [open, contact]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Same-origin: the dashboard session cookie authenticates the request.
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          unsubscribed,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not save changes.",
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
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: review requested an explicit role=dialog for this custom modal overlay. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="w-full max-w-md bg-bg-card border border-line rounded-lg shadow-xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 id={dialogTitleId} className="text-[16px] font-semibold text-fg">
            Edit contact
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
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

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-contact-first"
                className="block text-[13px] font-medium text-fg mb-1.5"
              >
                First name
              </label>
              <input
                ref={firstNameInputRef}
                id="edit-contact-first"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
              />
            </div>
            <div>
              <label
                htmlFor="edit-contact-last"
                className="block text-[13px] font-medium text-fg mb-1.5"
              >
                Last name
              </label>
              <input
                id="edit-contact-last"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3 focus-visible:ring-2 focus-visible:ring-white/30"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-fg cursor-pointer">
            <input
              type="checkbox"
              checked={unsubscribed}
              onChange={(e) => setUnsubscribed(e.target.checked)}
              className="accent-white rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            />
            Unsubscribed from all mail
          </label>

          {submitError && (
            <p className="text-[12px] text-red-400" role="alert">
              {submitError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] font-medium text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="btn btn-primary btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
