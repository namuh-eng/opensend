"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon, type IconName } from "./icons";

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  group: string;
  href: string;
  keywords?: string[];
};

const COMMANDS: CommandItem[] = [
  {
    id: "today",
    label: "Today",
    group: "Overview",
    icon: "overview",
    href: "/",
    keywords: ["home", "dashboard", "stats"],
  },
  {
    id: "emails",
    label: "Emails",
    group: "Messaging",
    icon: "emails",
    href: "/emails",
    keywords: ["sent", "messages"],
  },
  {
    id: "broadcasts",
    label: "Broadcasts",
    group: "Messaging",
    icon: "broadcasts",
    href: "/broadcasts",
  },
  {
    id: "automations",
    label: "Automations",
    group: "Messaging",
    icon: "automations",
    href: "/automations",
    keywords: ["workflows", "triggers"],
  },
  {
    id: "templates",
    label: "Templates",
    group: "Messaging",
    icon: "templates",
    href: "/templates",
  },
  {
    id: "domains",
    label: "Domains",
    group: "Configure",
    icon: "domains",
    href: "/domains",
    keywords: ["dns", "dkim", "spf"],
  },
  {
    id: "audience",
    label: "Audience",
    group: "Configure",
    icon: "audience",
    href: "/audience",
    keywords: ["contacts", "segments"],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    group: "Configure",
    icon: "webhooks",
    href: "/webhooks",
    keywords: ["events", "endpoints"],
  },
  {
    id: "api-keys",
    label: "API Keys",
    group: "Configure",
    icon: "keys",
    href: "/api-keys",
    keywords: ["tokens"],
  },
  {
    id: "metrics",
    label: "Metrics",
    group: "Inspect",
    icon: "metrics",
    href: "/metrics",
    keywords: ["analytics", "stats"],
  },
  {
    id: "logs",
    label: "Logs",
    group: "Inspect",
    icon: "logs",
    href: "/logs",
    keywords: ["activity", "events"],
  },
  {
    id: "exports",
    label: "Exports",
    group: "Inspect",
    icon: "logs",
    href: "/exports",
    keywords: ["csv", "download", "history"],
  },
  {
    id: "audit",
    label: "Audit log",
    group: "Inspect",
    icon: "audit",
    href: "/audit-log",
    keywords: ["history", "security"],
  },
  {
    id: "billing",
    label: "Billing",
    group: "Account",
    icon: "billing",
    href: "/settings/billing",
    keywords: ["plan", "payment"],
  },
  {
    id: "settings",
    label: "Settings",
    group: "Account",
    icon: "settings",
    href: "/settings",
    keywords: ["account", "profile"],
  },
  {
    id: "docs",
    label: "Documentation",
    hint: "/docs",
    group: "External",
    icon: "search",
    href: "/docs",
  },
];

type Ctx = { open: () => void; close: () => void; isOpen: boolean };
const PaletteCtx = createContext<Ctx | null>(null);

export function useCommandPalette(): Ctx {
  const ctx = useContext(PaletteCtx);
  if (!ctx) {
    return { open: () => {}, close: () => {}, isOpen: false };
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PaletteCtx.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen && <Palette onClose={close} />}
    </PaletteCtx.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => {
      const hay = [c.label, c.group, c.hint, ...(c.keywords ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of results) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return Array.from(map.entries());
  }, [results]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[active];
      if (target) {
        router.push(target.href);
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // biome-ignore lint/a11y/useSemanticElements: native <dialog> requires imperative showModal()
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="w-full max-w-[560px] overflow-hidden rounded-card border border-line-2 bg-bg-card shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
          <span className="inline-flex h-4 w-4 text-fg-3">
            <Icon.search />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-3"
          />
          <span className="kbd">esc</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-fg-3">
              No matches for <span className="mono text-fg-2">"{query}"</span>
            </div>
          ) : (
            groups.map(([groupName, items]) => (
              <div key={groupName} className="mb-1.5">
                <div className="mono px-2 pb-1 pt-2 text-[10px] uppercase tracking-[0.14em] text-fg-4">
                  {groupName}
                </div>
                <div className="flex flex-col gap-px">
                  {items.map((item) => {
                    const idx = results.indexOf(item);
                    const isActive = idx === active;
                    const IconCmp = Icon[item.icon];
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => {
                          router.push(item.href);
                          onClose();
                        }}
                        className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                          isActive
                            ? "bg-accent-soft text-fg"
                            : "text-fg-2 hover:bg-white/[0.03]"
                        }`}
                      >
                        <span
                          className={`inline-flex h-4 w-4 ${
                            isActive ? "text-accent" : "text-fg-3"
                          }`}
                        >
                          <IconCmp />
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {item.hint && (
                          <span className="mono text-[11px] text-fg-4">
                            {item.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-line px-3 py-2 text-[11px] text-fg-3">
          <span className="kbd">↑↓</span>
          <span>navigate</span>
          <span className="ml-2 kbd">↵</span>
          <span>open</span>
          <span className="ml-auto kbd">⌘K</span>
        </div>
      </div>
    </div>
  );
}
