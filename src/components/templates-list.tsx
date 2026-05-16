"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface Template {
  id: string;
  name: string;
  alias: string;
  published: boolean;
  html?: string | null;
  createdAt: string;
}

type StatusFilter = "" | "draft" | "published";

async function readCreateTemplateError(res: Response): Promise<string> {
  const fallback = "Could not create template.";
  const payload: unknown = await res.json().catch(() => null);

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }

  return fallback;
}

function getCreatedTemplateId(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "id" in payload &&
    typeof payload.id === "string" &&
    payload.id
  ) {
    return payload.id;
  }

  return null;
}

export function TemplatesList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingStarter, setCreatingStarter] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const authHeaders: Record<string, string> = {};
      if (apiKey) authHeaders.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/templates", { headers: authHeaders });
      const data = await res.json();
      setTemplates(data.data || []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(e.target as Node)
      ) {
        setActionMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearchChange = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/templates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Untitled Template",
          html: "<p>Start writing your email template.</p>",
        }),
      });
      if (!res.ok) {
        setCreateError(await readCreateTemplateError(res));
        return;
      }

      const templateId = getCreatedTemplateId(await res.json());
      if (!templateId) {
        setCreateError(
          "Template was created but no editor route was returned.",
        );
        return;
      }

      router.push(`/templates/${templateId}/editor`);
    } catch {
      setCreateError("Could not create template.");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateReactEmailStarter = async () => {
    setCreatingStarter(true);
    setCreateError(null);
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/templates", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Onboarding welcome",
          react_email_template_key: "onboarding-welcome",
        }),
      });
      if (!res.ok) {
        setCreateError(await readCreateTemplateError(res));
        return;
      }

      const templateId = getCreatedTemplateId(await res.json());
      if (!templateId) {
        setCreateError(
          "Template was created but no preview route was returned.",
        );
        return;
      }

      router.push(`/templates/${templateId}`);
    } catch {
      setCreateError("Could not create React Email starter.");
    } finally {
      setCreatingStarter(false);
    }
  };

  const handleDuplicate = async (t: Template) => {
    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage?.getItem?.("api_key") ?? null)
          : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const res = await fetch("/api/templates", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `${t.name} (copy)` }),
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch {
      // ignore
    }
    setActionMenuId(null);
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE" });
      fetchTemplates();
    } catch {
      // ignore
    }
    setActionMenuId(null);
  };

  const handleRenameSubmit = async (id: string) => {
    if (!renameValue.trim()) {
      setRenameId(null);
      return;
    }
    try {
      await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      fetchTemplates();
    } catch {
      // ignore
    }
    setRenameId(null);
  };

  useEffect(() => {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renameId]);

  // Client-side filtering
  const filtered = templates.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter === "published" && !t.published) return false;
    if (statusFilter === "draft" && t.published) return false;
    return true;
  });

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search..."
            className="w-full h-9 px-3 text-[13px] bg-transparent border border-line rounded-md text-fg placeholder-[#666] outline-none focus:border-line-3"
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <div className="relative" ref={statusDropdownRef}>
          <button
            type="button"
            onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
            className="h-9 px-3 text-[13px] border border-line rounded-md text-fg-2 hover:text-fg hover:border-line-3 transition-colors flex items-center gap-1.5 min-w-[130px]"
          >
            <span>
              {statusFilter === "draft"
                ? "Draft"
                : statusFilter === "published"
                  ? "Published"
                  : "All Statuses"}
            </span>
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="ml-auto"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {statusDropdownOpen && (
            <div
              role="menu"
              className="absolute top-full left-0 mt-1 w-[180px] bg-bg-card border border-line rounded-md shadow-lg z-50 py-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStatusFilter("");
                  setStatusDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/[0.08] transition-colors ${!statusFilter ? "text-fg" : "text-fg-2"}`}
              >
                All Statuses
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStatusFilter("draft");
                  setStatusDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/[0.08] transition-colors ${statusFilter === "draft" ? "text-fg" : "text-fg-2"}`}
              >
                Draft
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setStatusFilter("published");
                  setStatusDropdownOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-white/[0.08] transition-colors ${statusFilter === "published" ? "text-fg" : "text-fg-2"}`}
              >
                Published
              </button>
            </div>
          )}
        </div>

        {/* API drawer button */}
        <button
          type="button"
          className="h-9 w-9 flex items-center justify-center border border-line rounded-md text-fg-2 hover:text-fg hover:border-line-3 transition-colors"
          aria-label="API reference"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M16 18l6-6-6-6" />
            <path d="M8 6l-6 6 6 6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleCreateReactEmailStarter}
          disabled={creatingStarter}
          className="h-9 px-4 text-[13px] font-medium border border-line rounded-md text-fg hover:border-line-3 disabled:cursor-not-allowed disabled:opacity-70 transition-colors flex items-center gap-1.5"
        >
          {creatingStarter ? "Creating..." : "Use React Email starter"}
        </button>

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="h-9 px-4 text-[13px] font-medium bg-white text-black rounded-md hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-70 transition-colors flex items-center gap-1.5"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {creating ? "Creating..." : "Create template"}
        </button>
      </div>

      {createError ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300"
        >
          {createError}
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[14px] text-fg-2">
          Loading templates...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <h3 className="text-[16px] font-semibold text-fg mb-2">
            No templates
          </h3>
          <p className="text-[14px] text-fg-2 text-center max-w-[360px] mb-6">
            Create reusable email templates for your application.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              data-testid="template-card"
              className="group border border-line rounded-lg overflow-hidden hover:border-line-3 transition-colors"
            >
              {/* Preview thumbnail */}
              <Link href={`/templates/${t.id}/editor`}>
                <div className="aspect-[4/3] bg-white flex items-start justify-start p-4 cursor-pointer">
                  <div className="w-3/4 space-y-2 pt-2">
                    <div className="h-1.5 bg-gray-200 rounded w-full" />
                    <div className="h-1.5 bg-gray-200 rounded w-3/4" />
                    <div className="h-1.5 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </Link>

              {/* Card footer */}
              <div className="px-3 py-2.5 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {renameId === t.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit(t.id);
                        if (e.key === "Escape") setRenameId(null);
                      }}
                      className="w-full text-[14px] font-medium text-fg bg-transparent border border-line-3 rounded px-1 outline-none"
                    />
                  ) : (
                    <Link
                      href={`/templates/${t.id}/editor`}
                      className="block text-[14px] font-medium text-fg hover:underline truncate"
                    >
                      {t.name}
                    </Link>
                  )}
                  <span className="text-[12px] text-fg-4 font-mono truncate block">
                    {t.alias}
                  </span>
                </div>

                {/* Actions menu */}
                <div
                  className="relative"
                  ref={actionMenuId === t.id ? actionMenuRef : null}
                >
                  <button
                    type="button"
                    aria-label="More actions"
                    onClick={() =>
                      setActionMenuId(actionMenuId === t.id ? null : t.id)
                    }
                    className="p-1 rounded hover:bg-white/[0.14] text-fg-2 hover:text-fg transition-colors opacity-0 group-hover:opacity-100"
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
                  {actionMenuId === t.id && (
                    <div className="absolute right-0 top-full mt-1 w-[200px] bg-bg-card border border-line rounded-md shadow-lg z-50 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          router.push(`/templates/${t.id}`);
                          setActionMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          router.push(`/templates/${t.id}/editor`);
                          setActionMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                      >
                        Edit template
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(t.id);
                          setRenameValue(t.name);
                          setActionMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                      >
                        Rename template
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(t)}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-fg-2 hover:bg-white/[0.08] hover:text-fg transition-colors"
                      >
                        Duplicate template
                      </button>
                      <div className="my-1 border-t border-line" />
                      <button
                        type="button"
                        onClick={() => handleRemove(t.id)}
                        className="w-full px-3 py-1.5 text-left text-[13px] text-red-400 hover:bg-white/[0.08] hover:text-red-300 transition-colors"
                      >
                        Remove template
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
