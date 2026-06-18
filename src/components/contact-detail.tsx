"use client";

import { CopyToClipboard } from "@/components/copy-to-clipboard";
import { EditContactModal } from "@/components/edit-contact-modal";
import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { StatusBadge } from "@/components/status-badge";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export interface ContactDetailData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: "subscribed" | "unsubscribed";
  segments: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; name: string }>;
  properties: Record<string, string>;
  createdAt: string;
  activity: Array<{ type: string; timestamp: string }>;
}

interface ContactDetailProps {
  contact: ContactDetailData;
}

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

function ActionsDropdown({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="More actions"
        className="p-2 rounded-lg hover:bg-white/[0.14] text-fg-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
        onClick={() => setOpen(!open)}
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
        <div className="absolute right-0 top-full mt-1 w-40 bg-bg-2 border border-line rounded-md shadow-lg z-50 py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-[13px] text-fg hover:bg-white/10 transition-colors"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit contact
          </button>
          <div className="border-t border-line my-1" />
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-[13px] text-red-400 hover:bg-white/10 transition-colors"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete contact
          </button>
        </div>
      )}
    </div>
  );
}

export function ContactDetail({ contact }: ContactDetailProps) {
  const propertyEntries = Object.entries(contact.properties || {});
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const deleteDialogTitleId = useId();

  useEffect(() => {
    if (!deleteOpen) return;
    deleteCancelRef.current?.focus();

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setDeleteOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [deleteOpen]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      // Same-origin: the dashboard session cookie authenticates the request.
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      router.push("/audience");
      router.refresh();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete contact.",
      );
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-medium text-white shrink-0"
          style={{ backgroundColor: getAvatarColor(contact.email) }}
        >
          {contact.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-fg-2 mb-0.5">Contact</p>
          <h1 className="text-[22px] font-semibold text-fg truncate">
            {contact.email}
          </h1>
        </div>
        <ActionsDropdown
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
      </div>

      <EditContactModal
        open={editOpen}
        contact={{
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          status: contact.status,
        }}
        onClose={() => setEditOpen(false)}
        onSuccess={() => router.refresh()}
      />

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setDeleteOpen(false);
          }}
        >
          <dialog
            open
            aria-modal="true"
            aria-labelledby={deleteDialogTitleId}
            className="w-full max-w-sm bg-bg-card border border-line rounded-lg shadow-xl p-6"
          >
            <h2
              id={deleteDialogTitleId}
              className="text-[16px] font-semibold text-fg mb-2"
            >
              Delete contact
            </h2>
            <p className="text-[13px] text-fg-2 mb-4">
              Permanently delete{" "}
              <span className="font-medium text-fg">{contact.email}</span>? This
              cannot be undone.
            </p>
            {deleteError && (
              <p className="text-[12px] text-red-400 mb-3" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                ref={deleteCancelRef}
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="px-3 py-1.5 text-[13px] font-medium text-fg-2 border border-line rounded-md hover:text-fg hover:border-line-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-[13px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </dialog>
        </div>
      )}

      {/* Metadata row 1 */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            EMAIL ADDRESS
          </p>
          <p className="text-[14px] text-fg">{contact.email}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            CREATED
          </p>
          <p
            className="text-[14px] text-fg"
            title={new Date(contact.createdAt).toLocaleString()}
          >
            {formatRelativeTime(contact.createdAt)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            STATUS
          </p>
          <StatusBadge
            status={
              contact.status === "subscribed" ? "Subscribed" : "Unsubscribed"
            }
            variant={contact.status === "subscribed" ? "success" : "default"}
          />
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            ID
          </p>
          <CopyToClipboard value={contact.id} />
        </div>
      </div>

      {/* Metadata row 2 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            SEGMENTS
          </p>
          {contact.segments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {contact.segments.map((seg) => (
                <span
                  key={seg.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium text-fg bg-white/[0.08]"
                >
                  {seg.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-fg-2">No segments</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
            TOPICS
          </p>
          {contact.topics.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {contact.topics.map((topic) => (
                <span
                  key={topic.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-medium text-fg bg-white/[0.08]"
                >
                  {topic.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-fg-2">No topics</p>
          )}
        </div>
      </div>

      {/* Properties */}
      <div className="mb-8">
        <h2 className="text-[18px] font-semibold text-fg mb-4">Properties</h2>
        {propertyEntries.length > 0 ? (
          <div className="grid grid-cols-4 gap-6">
            {propertyEntries.map(([key, value]) => (
              <div key={key}>
                <p className="text-[11px] font-medium text-fg-2 tracking-wider mb-1">
                  {key.toUpperCase()}
                </p>
                <p className="text-[14px] text-fg">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-fg-2">No properties</p>
        )}
      </div>

      {/* Activity */}
      <div>
        <h2 className="text-[18px] font-semibold text-fg mb-4">Activity</h2>
        <div className="bg-bg-2 border border-line rounded-lg p-4">
          {contact.activity.length > 0 ? (
            <div className="space-y-4">
              {contact.activity.map((event) => (
                <div
                  key={`${event.type}-${event.timestamp}`}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-white/[0.14] flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-fg-2 font-medium">O</span>
                  </div>
                  <span className="text-[14px] text-fg font-medium">
                    {event.type}
                  </span>
                  <span className="text-[13px] text-fg-2">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-fg-2">No activity</p>
          )}
        </div>
        <p className="text-[12px] text-fg-2 mt-2">
          Activity data may take a few seconds to update.
        </p>
      </div>
    </div>
  );
}
