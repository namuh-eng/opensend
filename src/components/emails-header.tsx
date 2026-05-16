"use client";

import { ApiCodeDrawer, ApiDrawerButton } from "@/components/api-code-drawer";
import { ExportModal } from "@/components/export-modal";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface EmailsHeaderProps {
  activeTab: "sending" | "receiving";
  apiKeys?: { id: string; name: string }[];
}

const tabs = [
  { value: "sending", label: "Sending", href: "/emails" },
  { value: "receiving", label: "Receiving", href: "/emails/receiving" },
] as const;

export function EmailsHeader({ activeTab, apiKeys = [] }: EmailsHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-fg">Emails</h1>
      </div>
      <div className="flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-0">
          {tabs.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <Link
                key={tab.value}
                href={tab.href}
                data-state={isActive ? "active" : "inactive"}
                className={`px-4 py-2 text-[14px] font-medium transition-colors relative ${
                  isActive ? "text-fg" : "text-fg-2 hover:text-fg"
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F0F0F0]" />
                )}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <ApiDrawerButton onClick={() => setDrawerOpen(true)} />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="More actions"
              className="p-1.5 rounded hover:bg-bg-2 text-fg-2 hover:text-fg transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="8" cy="3" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="13" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[160px] bg-bg-3 border border-line rounded-[8px] py-1 z-10">
                <button
                  type="button"
                  className="w-full block px-3 py-2 text-[13px] text-fg-2 hover:text-fg hover:bg-white/10 transition-colors text-left"
                  onClick={() => {
                    setExportOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Export delivery failures
                </button>
                <a
                  href="/docs"
                  className="block px-3 py-2 text-[13px] text-fg-2 hover:text-fg hover:bg-white/10 transition-colors"
                >
                  Go to docs
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      <ApiCodeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        context="emails"
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        apiKeys={apiKeys}
      />
    </div>
  );
}
