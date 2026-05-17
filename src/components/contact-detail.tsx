"use client";

import { CopyToClipboard } from "@/components/copy-to-clipboard";
import { formatRelativeTime } from "@/components/emails-sending-data-table";
import { StatusBadge } from "@/components/status-badge";
import { useRef, useState } from "react";

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
        className="p-2 rounded-lg hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors"
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
        <ActionsDropdown onEdit={() => {}} onDelete={() => {}} />
      </div>

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
