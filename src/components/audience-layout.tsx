"use client";

import { AddContactModal } from "@/components/add-contact-modal";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { label: "Contacts", href: "/audience" },
  { label: "Properties", href: "/audience/properties" },
  { label: "Segments", href: "/audience/segments" },
  { label: "Topics", href: "/audience/topics" },
];

interface AudienceLayoutProps {
  stats: {
    all: number;
    subscribed: number;
    unsubscribed: number;
  };
  children: React.ReactNode;
}

export function AudienceLayout({ stats, children }: AudienceLayoutProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-fg">Audience</h1>

        {/* Add contacts dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn btn-primary btn-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Add contacts
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-bg-2 border border-line rounded-md shadow-lg z-50 py-1">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[13px] text-fg hover:bg-white/10 transition-colors"
                onClick={() => {
                  setDropdownOpen(false);
                  setAddModalOpen(true);
                }}
              >
                Add manually
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-[13px] text-fg hover:bg-white/10 transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                Import CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-line mb-6">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/audience"
              ? pathname === "/audience"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-state={isActive ? "active" : "inactive"}
              className={`px-4 py-2 text-[14px] font-medium transition-colors relative ${
                isActive ? "text-fg" : "text-fg-2 hover:text-fg"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="flex items-start gap-12 mb-6">
        <div>
          <div className="text-[11px] font-medium tracking-wider text-fg-2 uppercase mb-1">
            ALL CONTACTS
          </div>
          <div className="text-[20px] font-semibold text-fg">{stats.all}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium tracking-wider text-fg-2 uppercase mb-1">
            SUBSCRIBERS
          </div>
          <div className="text-[20px] font-semibold text-fg">
            {stats.subscribed}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium tracking-wider text-fg-2 uppercase mb-1">
            UNSUBSCRIBERS
          </div>
          <div className="text-[20px] font-semibold text-fg">
            {stats.unsubscribed}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-medium tracking-wider text-fg-2 uppercase mb-1">
            METRICS
          </div>
        </div>
      </div>

      {/* Tab content */}
      {children}

      <AddContactModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
